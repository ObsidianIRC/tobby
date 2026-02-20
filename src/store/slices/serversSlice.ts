import type { Channel, PrivateChat, Server } from '@/types'
import type { StateCreator } from 'zustand'
import { getDatabase } from '../../services/database'

export interface ServersSlice {
  servers: Server[]
  addServer: (server: Server, persist?: boolean) => void
  updateServer: (id: string, updates: Partial<Server>) => void
  removeServer: (id: string) => void
  getServer: (id: string) => Server | undefined
  addChannel: (serverId: string, channel: Channel, persist?: boolean) => void
  updateChannel: (serverId: string, channelId: string, updates: Partial<Channel>) => void
  removeChannel: (serverId: string, channelId: string) => void
  getChannel: (serverId: string, channelId: string) => Channel | undefined
  addPrivateChat: (serverId: string, chat: PrivateChat) => void
  updatePrivateChat: (serverId: string, chatId: string, updates: Partial<PrivateChat>) => void
  removePrivateChat: (serverId: string, chatId: string) => void
  loadPersistedServers: () => void
  reorderServer: (serverId: string, direction: 'up' | 'down') => void
  reorderChannel: (serverId: string, channelId: string, direction: 'up' | 'down') => void
}

export const createServersSlice: StateCreator<ServersSlice> = (set, get) => ({
  servers: [],

  addServer: (server, persist = true) => {
    set((state) => ({
      servers: [...state.servers, server],
    }))

    if (persist) {
      try {
        const db = getDatabase()
        db.saveServer(server)
      } catch (error) {
        console.error('Failed to persist server:', error)
      }
    }
  },

  updateServer: (id, updates) => {
    set((state) => ({
      servers: state.servers.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }))

    try {
      const db = getDatabase()
      // Strip runtime-only fields that don't exist in the servers table
      const {
        isConnected: _ic,
        connectionState,
        channels: _ch,
        privateChats: _pc,
        ...dbUpdates
      } = updates as any
      if (Object.keys(dbUpdates).length > 0) {
        db.updateServer(id, dbUpdates)
      }
      if (connectionState) {
        db.saveServerState(id, { connectionState })
      }
    } catch (error) {
      debugLog?.('Failed to update server:', error)
    }
  },

  removeServer: (id) => {
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== id),
    }))

    try {
      const db = getDatabase()
      db.deleteServer(id)
    } catch (error) {
      console.error('Failed to remove server:', error)
    }
  },

  getServer: (id) => {
    const state = get()
    return state.servers.find((s) => s.id === id)
  },

  addChannel: (serverId, channel, persist = true) => {
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId ? { ...s, channels: [...s.channels, channel] } : s
      ),
    }))

    // If this is the current server and no channel is focused yet, jump to this one
    const { currentServerId, currentChannelId, setCurrentChannel } = get()
    if (currentServerId === serverId && !currentChannelId) {
      setCurrentChannel(channel.id)
    }

    if (persist) {
      try {
        const db = getDatabase()
        // Only persist basic channel info (id, name), not the full object with users/messages
        const simpleChannel: Channel = {
          id: channel.id,
          name: channel.name,
          serverId: serverId,
          topic: channel.topic || '',
          users: [],
          messages: [],
          unreadCount: 0,
          isPrivate: false,
          isMentioned: false,
        }
        db.saveChannel(simpleChannel, serverId)
      } catch (error) {
        console.error('Failed to persist channel:', error)
      }
    }
  },

  updateChannel: (serverId, channelId, updates) =>
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId
          ? {
              ...s,
              channels: s.channels.map((c) => (c.id === channelId ? { ...c, ...updates } : c)),
            }
          : s
      ),
    })),

  removeChannel: (serverId, channelId) => {
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId ? { ...s, channels: s.channels.filter((c) => c.id !== channelId) } : s
      ),
    }))

    try {
      const db = getDatabase()
      db.deleteChannel(channelId)
    } catch (error) {
      console.error('Failed to remove channel:', error)
    }
  },

  getChannel: (serverId, channelId) => {
    const state = get()
    const server = state.servers.find((s) => s.id === serverId)
    return server?.channels.find((c) => c.id === channelId)
  },

  addPrivateChat: (serverId, chat) =>
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId ? { ...s, privateChats: [...s.privateChats, chat] } : s
      ),
    })),

  updatePrivateChat: (serverId, chatId, updates) =>
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId
          ? {
              ...s,
              privateChats: s.privateChats.map((pc) =>
                pc.id === chatId ? { ...pc, ...updates } : pc
              ),
            }
          : s
      ),
    })),

  removePrivateChat: (serverId, chatId) =>
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId
          ? { ...s, privateChats: s.privateChats.filter((pc) => pc.id !== chatId) }
          : s
      ),
    })),

  reorderServer: (serverId, direction) => {
    const servers = get().servers
    const idx = servers.findIndex((s) => s.id === serverId)
    if (idx === -1) return
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= servers.length) return

    const reordered = [...servers]
    const tmp = reordered[idx]!
    reordered[idx] = reordered[newIdx]!
    reordered[newIdx] = tmp
    set({ servers: reordered })

    try {
      const db = getDatabase()
      reordered.forEach((s, i) => db.updateServerSortOrder(s.id, i))
    } catch (error) {
      debugLog?.('Failed to persist server order:', error)
    }
  },

  reorderChannel: (serverId, channelId, direction) => {
    const server = get().servers.find((s) => s.id === serverId)
    if (!server) return
    const idx = server.channels.findIndex((c) => c.id === channelId)
    if (idx === -1) return
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= server.channels.length) return

    const reordered = [...server.channels]
    const tmp = reordered[idx]!
    reordered[idx] = reordered[newIdx]!
    reordered[newIdx] = tmp
    set((state) => ({
      servers: state.servers.map((s) => (s.id === serverId ? { ...s, channels: reordered } : s)),
    }))

    try {
      const db = getDatabase()
      reordered.forEach((c, i) => db.updateChannelSortOrder(c.id, i))
    } catch (error) {
      debugLog?.('Failed to persist channel order:', error)
    }
  },

  loadPersistedServers: () => {
    try {
      const db = getDatabase()
      const persistedServers = db.getAutoConnectServers()

      const servers: Server[] = persistedServers.map((ps) => {
        const channels: Channel[] = db.getAutoJoinChannels(ps.id).map((pc) => ({
          id: pc.id,
          name: pc.name,
          serverId: ps.id,
          topic: '',
          users: [],
          messages: [],
          unreadCount: 0,
          isPrivate: false,
          isMentioned: false,
        }))

        return {
          id: ps.id,
          name: ps.name,
          host: ps.host,
          port: ps.port,
          ssl: Boolean(ps.ssl),
          nickname: ps.nickname,
          username: ps.username || undefined,
          realname: ps.realname || undefined,
          password: ps.password || undefined,
          saslUsername: ps.sasl_account || undefined,
          saslPassword: ps.sasl_password || undefined,
          connectionState: 'disconnected' as const,
          channels,
          privateChats: [],
        }
      })

      set({ servers })

      // Auto-focus the first server/channel so the app never lands on the blank screen
      const { currentServerId, setCurrentServer, setCurrentChannel } = get()
      if (!currentServerId && servers.length > 0) {
        const first = servers[0]!
        setCurrentServer(first.id)
        if (first.channels.length > 0) setCurrentChannel(first.channels[0]!.id)
      }
    } catch (error) {
      console.error('Failed to load persisted servers:', error)
    }
  },
})
