import { IRCClient as BaseIRCClient, type EventMap } from '@irc/ircClient'
import { NodeTCPSocket } from '../lib/nodeTcpSocket'

/**
 * Type-safe event listener helper
 */
export type IRCEventKey = keyof EventMap
export type IRCEventCallback<K extends IRCEventKey> = (data: EventMap[K]) => void

/**
 * Extended IRC client with Node.js TCP socket support
 *
 * This catches the Tauri socket error and manually creates a connection
 * using Node.js sockets instead.
 */
export class IRCClient extends BaseIRCClient {
  // Side-channel: the IRC `time` tag of the message currently being processed.
  // Populated just before handleMessage() and read by ircSlice event handlers.
  // Safe because JS is single-threaded — the handler runs synchronously inside handleMessage.
  private _lastMsgTime = new Map<string, Date>()
  // Callbacks invoked whenever a PONG is received for a given server (used for keepalive).
  private _pongCallbacks = new Map<string, () => void>()

  getLastMessageTime(serverId: string): Date {
    return this._lastMsgTime.get(serverId) ?? new Date()
  }

  onPong(serverId: string, cb: () => void): void {
    this._pongCallbacks.set(serverId, cb)
  }

  offPong(serverId: string): void {
    this._pongCallbacks.delete(serverId)
  }

  override async connect(
    name: string,
    host: string,
    port: number,
    nickname: string,
    password?: string,
    saslAccountName?: string,
    saslPassword?: string,
    serverId?: string
  ): Promise<any> {
    // Don't call super.connect() at all - it tries to use Tauri sockets which don't exist
    // Directly implement the connection using Node.js sockets

    const url = `${port === 6697 || port === 6679 ? 'ircs' : 'irc'}://${host}:${port}`

    const nodeSocket = new NodeTCPSocket(url)

    const finalName = name?.trim() || host
    const server: any = {
      id: serverId || `${host}:${port}`,
      name: finalName,
      host: host,
      port,
      channels: [],
      privateChats: [],
      isConnected: false,
      connectionState: 'connecting',
      users: [],
      capabilities: [],
    }

    // Store the server and socket
    ;(this as any).servers.set(server.id, server)
    ;(this as any).sockets.set(server.id, nodeSocket)
    ;(this as any).nicks.set(server.id, nickname)

    // Create current user
    ;(this as any).currentUsers.set(server.id, {
      id: `user-${Date.now()}`,
      username: nickname,
      isOnline: true,
      status: 'online',
    })

    // Store SASL credentials if provided
    if (saslAccountName && saslPassword) {
      ;(this as any).saslEnabled.set(server.id, true)
      ;(this as any).saslCredentials.set(server.id, {
        username: saslAccountName,
        password: saslPassword,
      })
    }

    // Set up socket handlers to match BaseIRCClient behavior
    nodeSocket.onopen = () => {
      debugLog?.(`[IRC] Socket opened for ${host}:${port}`)
      nodeSocket.send('CAP LS 302')
      if (password) {
        nodeSocket.send(`PASS ${password}`)
      }
      nodeSocket.send(`NICK ${nickname}`)
      // USER is sent by the base class after CAP negotiation completes (userOnConnect)
    }

    nodeSocket.onmessage = (event) => {
      // Feed lines one-at-a-time so the base class's `return` inside the PRIVMSG
      // batch handler doesn't drop subsequent lines in the same TCP data buffer.
      const rawLines = event.data.split('\r\n')
      for (const rawLine of rawLines) {
        if (rawLine.trim()) {
          // Extract the IRC `time` tag before the base class fires any events.
          // The base class calls triggerEvent() synchronously inside handleMessage(),
          // so _lastMsgTime will hold the correct value when ircSlice handlers run.
          if (rawLine.startsWith('@')) {
            const tagEnd = rawLine.indexOf(' ')
            const timeTag = rawLine
              .slice(1, tagEnd)
              .split(';')
              .find((t) => t.startsWith('time='))
            this._lastMsgTime.set(server.id, timeTag ? new Date(timeTag.slice(5)) : new Date())
          } else {
            this._lastMsgTime.set(server.id, new Date())
          }
          ;(this as any).handleMessage(rawLine + '\r\n', server.id)
        }
      }

      const lines = event.data.split('\r\n')
      for (const line of lines) {
        // Strip IRCv3 message tags (@key=val;... ) so tagged servers (e.g. server-time) work
        const bare = line.startsWith('@') ? line.slice(line.indexOf(' ') + 1) : line
        if (!bare.startsWith(':')) continue

        // RPL_WELCOME (001) — mark as connected
        if (bare.includes(' 001 ')) {
          if (!server.isConnected) {
            server.isConnected = true
            server.connectionState = 'connected'
            ;(this as any).triggerEvent('connectionStateChange', {
              serverId: server.id,
              connectionState: 'connected',
            })
          }
        }

        // 433 — Nickname already in use, retry with _ suffix
        if (bare.includes(' 433 ')) {
          const currentNick = (this as any).nicks.get(server.id) as string
          const newNick = currentNick + '_'
          ;(this as any).nicks.set(server.id, newNick)
          nodeSocket.send(`NICK ${newNick}`)
        }

        // Forward numeric replies and server NOTICEs as serverMessage events
        const parts = bare.split(' ')
        const command = parts[1]
        if (command && /^\d{3}$/.test(command)) {
          const textStart = bare.indexOf(':', 1)
          const text = textStart !== -1 ? bare.slice(textStart + 1) : parts.slice(3).join(' ')
          ;(this as any).triggerEvent('serverMessage', {
            serverId: server.id,
            command,
            text,
            raw: line,
          })
        } else if (command === 'NOTICE' && !parts[2]?.startsWith('#')) {
          const textStart = bare.indexOf(':', 1)
          const text = textStart !== -1 ? bare.slice(textStart + 1) : ''
          ;(this as any).triggerEvent('serverMessage', {
            serverId: server.id,
            command: 'NOTICE',
            text,
            raw: line,
          })
        } else if (command === 'PONG') {
          this._pongCallbacks.get(server.id)?.()
        }
      }
    }

    nodeSocket.onerror = (err) => {
      debugLog?.(`[IRC] Socket error for ${host}:`, err.message)
      ;(this as any).triggerEvent('error', {
        serverId: server.id,
        error: err.message,
      })
    }

    nodeSocket.onclose = () => {
      debugLog?.(`[IRC] Socket closed for ${host}`)
      server.isConnected = false
      server.connectionState = 'disconnected'
      ;(this as any).triggerEvent('disconnect', { serverId: server.id })
    }

    debugLog?.(`[IRC] Socket handlers configured for ${host}:${port}, waiting for connection...`)
    return { id: server.id, server }
  }
}

export type { EventMap }

/**
 * Create a new IRC client instance with Node.js socket support
 */
export function createIRCClient(): IRCClient {
  return new IRCClient()
}
