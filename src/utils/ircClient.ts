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
      if (password) {
        nodeSocket.send(`PASS ${password}`)
      }

      nodeSocket.send(`NICK ${nickname}`)

      const username = nickname.replace(/[^a-zA-Z0-9]/g, '').substring(0, 9)
      nodeSocket.send(`USER ${username} 0 * :${nickname}`)
    }

    nodeSocket.onmessage = (event) => {
      ;(this as any).handleMessage(event.data, server.id)

      const lines = event.data.split('\r\n')
      for (const line of lines) {
        if (!line.startsWith(':')) continue

        // RPL_WELCOME (001) — mark as connected
        if (line.includes(' 001 ')) {
          if (!server.isConnected) {
            debugLog?.(`[IRC] RPL_WELCOME received for ${host} - connected!`)
            server.isConnected = true
            server.connectionState = 'connected'
            ;(this as any).triggerEvent('connectionStateChange', {
              serverId: server.id,
              connectionState: 'connected',
            })
          }
        }

        // 433 — Nickname already in use, retry with _ suffix
        if (line.includes(' 433 ')) {
          const currentNick = (this as any).nicks.get(server.id) as string
          const newNick = currentNick + '_'
          debugLog?.(`[IRC] Nick "${currentNick}" in use, retrying as "${newNick}"`)
          ;(this as any).nicks.set(server.id, newNick)
          nodeSocket.send(`NICK ${newNick}`)
        }

        // Forward "interesting" server messages (numeric replies, server NOTICEs)
        const parts = line.split(' ')
        const command = parts[1]
        if (command && /^\d{3}$/.test(command)) {
          // Extract the text after the numeric + target (e.g. ":server 001 nick :Welcome...")
          const textStart = line.indexOf(':', 1)
          const text = textStart !== -1 ? line.slice(textStart + 1) : parts.slice(3).join(' ')
          ;(this as any).triggerEvent('serverMessage', {
            serverId: server.id,
            command,
            text,
            raw: line,
          })
        } else if (command === 'NOTICE' && !parts[2]?.startsWith('#')) {
          const textStart = line.indexOf(':', 1)
          const text = textStart !== -1 ? line.slice(textStart + 1) : ''
          ;(this as any).triggerEvent('serverMessage', {
            serverId: server.id,
            command: 'NOTICE',
            text,
            raw: line,
          })
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
