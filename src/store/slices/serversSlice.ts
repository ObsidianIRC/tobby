import type { Channel, Server } from '@/types'
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
  loadPersistedServers: () => void
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
      db.updateServer(id, updates)
      if (updates.connectionState) {
        db.saveServerState(id, { connectionState: updates.connectionState })
      }
    } catch (error) {
      console.error('Failed to update server:', error)
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

    if (persist) {
      try {
        const db = getDatabase()
        // Only persist basic channel info (id, name), not the full object with users/messages
        const simpleChannel = {
          id: channel.id,
          name: channel.name,
          topic: channel.topic || '',
          users: [],
          unreadCount: 0,
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

  loadPersistedServers: () => {
    try {
      const db = getDatabase()
      const persistedServers = db.getAutoConnectServers()

      const servers: Server[] = persistedServers.map((ps) => {
        const channels = db.getAutoJoinChannels(ps.id).map((pc) => ({
          id: pc.id,
          name: pc.name,
          topic: '',
          users: [],
          unreadCount: 0,
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
          connectionState: 'disconnected',
          channels,
          privateChats: [],
        }
      })

      set({ servers })
    } catch (error) {
      console.error('Failed to load persisted servers:', error)
    }
  },
})
