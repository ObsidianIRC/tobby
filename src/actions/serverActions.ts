import type { ActionContext } from '@/types'
import type { AppStore } from '@/store'
import type { ActionRegistry } from '@/actions'
import { v4 as uuidv4 } from 'uuid'
import { noAutoReconnectServers } from '@/store/slices/ircSlice'
import { getDatabase } from '@/services/database'
import { deterministicChannelId } from '@/utils/bootstrapServer'
import type { Channel } from '@/types'

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
        channels?: string[]
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

      // Add server to store (and DB) first
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

      // Persist auto-join channels now that the server row exists in the DB
      if (params.channels?.length) {
        const db = getDatabase()
        for (const ch of params.channels) {
          const name = ch.startsWith('#') ? ch : `#${ch}`
          db.saveChannel(
            { id: deterministicChannelId(serverId, name), name, serverId } as Channel,
            serverId
          )
        }
      }

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

      // Disconnect from IRC server (suppress auto-reconnect)
      noAutoReconnectServers.add(currentServer.id)
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

      // If already connected, disconnect first.
      // Mark so auto-reconnect doesn't race with our manual reconnect below.
      if (currentServer.isConnected) {
        noAutoReconnectServers.add(currentServer.id)
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

  // Disconnect and remove current server, focusing the one above
  registry.register({
    id: 'server.disconnectAndRemove',
    label: 'Disconnect & Remove Server',
    description: 'Disconnect from the current server and remove it from the list',
    category: 'server',
    keywords: ['disconnect', 'remove', 'delete', 'server'],
    priority: 85,

    isEnabled: (ctx) => !!ctx.currentServer,
    isVisible: (ctx) => !!ctx.currentServer,

    execute: async (ctx: ActionContext<AppStore>) => {
      const { store, ircClient, currentServer } = ctx
      if (!currentServer) return

      const servers = store.servers
      const idx = servers.findIndex((s) => s.id === currentServer.id)

      if (currentServer.isConnected && ircClient) {
        noAutoReconnectServers.add(currentServer.id)
        ircClient.sendRaw(currentServer.id, 'QUIT :Disconnecting')
        ircClient.disconnect(currentServer.id)
      }

      store.removeServer(currentServer.id)

      const remaining = servers.filter((s) => s.id !== currentServer.id)
      const next = remaining[idx - 1] ?? remaining[0] ?? null
      store.setCurrentServer(next?.id ?? null)
      store.setCurrentChannel(null)
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
        noAutoReconnectServers.add(server.id)
        ircClient.disconnect(server.id)
      }
      store.removeServer(server.id)
      store.setCurrentServer(null)
      store.setCurrentChannel(null)
    },
  })
}
