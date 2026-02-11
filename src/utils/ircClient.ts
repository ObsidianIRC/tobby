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
      // Send password if provided
      if (password) {
        nodeSocket.send(`PASS ${password}`)
      }

      // Send NICK
      nodeSocket.send(`NICK ${nickname}`)

      // Send USER (required for registration)
      // Format: USER <username> <mode> <unused> :<realname>
      const username = nickname.replace(/[^a-zA-Z0-9]/g, '').substring(0, 9)
      nodeSocket.send(`USER ${username} 0 * :${nickname}`)
    }

    nodeSocket.onmessage = (event) => {
      // Pass all messages to the base client's message handler
      ;(this as any).handleMessage(event.data, server.id)

      // Check for registration completion
      const message = event.data
      if (message.startsWith(':') && message.includes(' 001 ')) {
        // 001 RPL_WELCOME - Registration complete
        if (!server.isConnected) {
          server.isConnected = true
          server.connectionState = 'connected'
          ;(this as any).triggerEvent('connectionStateChange', {
            serverId: server.id,
            connectionState: 'connected',
          })
        }
      }
    }

    nodeSocket.onerror = (err) => {
      ;(this as any).triggerEvent('error', {
        serverId: server.id,
        error: err.message,
      })
    }

    nodeSocket.onclose = () => {
      server.isConnected = false
      server.connectionState = 'disconnected'
      ;(this as any).triggerEvent('disconnect', { serverId: server.id })
    }

    console.log('[IRC-DEBUG] Socket handlers configured, waiting for connection...')
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
