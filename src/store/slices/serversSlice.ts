import type { Channel, Server } from '@/types'
import type { StateCreator } from 'zustand'

export interface ServersSlice {
  servers: Server[]
  addServer: (server: Server) => void
  updateServer: (id: string, updates: Partial<Server>) => void
  removeServer: (id: string) => void
  getServer: (id: string) => Server | undefined
  addChannel: (serverId: string, channel: Channel) => void
  updateChannel: (serverId: string, channelId: string, updates: Partial<Channel>) => void
  removeChannel: (serverId: string, channelId: string) => void
  getChannel: (serverId: string, channelId: string) => Channel | undefined
}

export const createServersSlice: StateCreator<ServersSlice> = (set, get) => ({
  servers: [],

  addServer: (server) =>
    set((state) => ({
      servers: [...state.servers, server],
    })),

  updateServer: (id, updates) =>
    set((state) => ({
      servers: state.servers.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),

  removeServer: (id) =>
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== id),
    })),

  getServer: (id) => {
    const state = get()
    return state.servers.find((s) => s.id === id)
  },

  addChannel: (serverId, channel) =>
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId ? { ...s, channels: [...s.channels, channel] } : s
      ),
    })),

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

  removeChannel: (serverId, channelId) =>
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId ? { ...s, channels: s.channels.filter((c) => c.id !== channelId) } : s
      ),
    })),

  getChannel: (serverId, channelId) => {
    const state = get()
    const server = state.servers.find((s) => s.id === serverId)
    return server?.channels.find((c) => c.id === channelId)
  },
})
