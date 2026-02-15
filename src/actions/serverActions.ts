import type { ActionContext } from '@/types'
import type { AppStore } from '@/store'
import type { ActionRegistry } from '@/actions'
import { v4 as uuidv4 } from 'uuid'

export function registerServerActions(registry: ActionRegistry<AppStore>) {
  // Connect to server
  registry.register({
    id: 'server.connect',
    label: 'Add Server',
    description: 'Add and connect to an IRC server',
    category: 'server',
    keywords: ['connect', 'server', 'irc', 'add', 'new'],
    priority: 100,

    isEnabled: () => true,
    isVisible: () => true,

    execute: async (ctx: ActionContext<AppStore>) => {
      const { store } = ctx

      // Open connect modal (assuming store has direct access to actions)
      store.openModal('connect')
    },
  })

  // Connect with parameters (for programmatic use)
  registry.register({
    id: 'server.connectWith',
    label: 'Connect to Server (Direct)',
    description: 'Connect to an IRC server with provided parameters',
    category: 'server',
    priority: 90,

    isEnabled: (ctx) => {
      return !!ctx.ircClient
    },

    isVisible: () => false, // Hidden from UI, used programmatically

    execute: async (
      ctx: ActionContext<AppStore>,
      params?: {
        name: string
        host: string
        port: number
        nickname: string
        password?: string
        saslUsername?: string
        saslPassword?: string
      }
    ) => {
      if (!params) {
        throw new Error('Connection parameters are required')
      }

      const { store, ircClient } = ctx
      if (!ircClient) {
        throw new Error('IRC client not initialized')
      }

      const serverId = uuidv4()

      // Add server to store first
      store.addServer({
        id: serverId,
        name: params.name,
        host: params.host,
        port: params.port,
        nickname: params.nickname,
        password: params.password,
        saslUsername: params.saslUsername,
        saslPassword: params.saslPassword,
        isConnected: false,
        connectionState: 'connecting',
        channels: [],
        privateChats: [],
      })

      // Set as current server immediately
      store.setCurrentServer(serverId)

      // Connect to IRC server
      try {
        await ircClient.connect(
          params.name,
          params.host,
          params.port,
          params.nickname,
          params.password,
          params.saslUsername,
          params.saslPassword,
          serverId
        )
      } catch (error) {
        // Update server state on error
        store.updateServer(serverId, {
          isConnected: false,
          connectionState: 'disconnected',
        })
        throw error
      }
    },
  })

  // Disconnect from server
  registry.register({
    id: 'server.disconnect',
    label: 'Disconnect from Server',
    description: 'Disconnect from the current IRC server',
    category: 'server',
    keybinding: ':disconnect',
    keywords: ['disconnect', 'server', 'quit', 'leave'],
    priority: 90,

    isEnabled: (ctx) => {
      return !!ctx.currentServer?.isConnected
    },

    isVisible: (ctx) => {
      return !!ctx.currentServer
    },

    execute: async (ctx: ActionContext<AppStore>) => {
      const { store, ircClient, currentServer } = ctx
      if (!ircClient || !currentServer) {
        throw new Error('No server connected')
      }

      // Disconnect from IRC server
      ircClient.disconnect(currentServer.id)

      // Update server state
      store.updateServer(currentServer.id, {
        isConnected: false,
        connectionState: 'disconnected',
      })
    },
  })

  // Reconnect to server
  registry.register({
    id: 'server.reconnect',
    label: 'Reconnect to Server',
    description: 'Reconnect to the current IRC server',
    category: 'server',
    keybinding: ':reconnect',
    keywords: ['reconnect', 'server', 'rejoin'],
    priority: 85,

    isEnabled: (ctx) => {
      return !!ctx.currentServer
    },

    isVisible: (ctx) => {
      return !!ctx.currentServer
    },

    execute: async (ctx: ActionContext<AppStore>) => {
      const { store, ircClient, currentServer } = ctx
      if (!ircClient || !currentServer) {
        throw new Error('No server selected')
      }

      // If already connected, disconnect first
      if (currentServer.isConnected) {
        ircClient.disconnect(currentServer.id)
      }

      // Update state to reconnecting
      store.updateServer(currentServer.id, {
        connectionState: 'reconnecting',
      })

      // Reconnect
      try {
        await ircClient.connect(
          currentServer.name,
          currentServer.host,
          currentServer.port,
          currentServer.nickname,
          currentServer.password,
          currentServer.saslUsername,
          currentServer.saslPassword,
          currentServer.id
        )
      } catch (error) {
        store.updateServer(currentServer.id, {
          isConnected: false,
          connectionState: 'disconnected',
        })
        throw error
      }
    },
  })

  // Remove server
  registry.register({
    id: 'server.remove',
    label: 'Remove Server',
    description: 'Remove a server from the list',
    category: 'server',
    keybinding: ':server-remove',
    keywords: ['remove', 'delete', 'server'],
    priority: 80,

    isEnabled: () => true,

    isVisible: (ctx) => {
      return ctx.store.servers.length > 0
    },

    execute: async (ctx: ActionContext<AppStore>) => {
      const { store, ircClient } = ctx
      const servers = store.servers

      if (servers.length === 0) return

      if (servers.length > 1) {
        store.openModal('removeServer')
        return
      }

      // Single server — remove directly
      const server = servers[0]!
      if (server.isConnected && ircClient) {
        ircClient.disconnect(server.id)
      }
      store.removeServer(server.id)
      store.setCurrentServer(null)
      store.setCurrentChannel(null)
    },
  })
}
