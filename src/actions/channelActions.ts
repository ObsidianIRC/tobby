import type { ActionContext, Server } from '@/types'
import type { AppStore } from '@/store'
import type { ActionRegistry } from '@/actions'

interface BufferEntry {
  serverId: string
  channelId: string | null // null = server buffer
}

function getBufferList(servers: Server[]): BufferEntry[] {
  const buffers: BufferEntry[] = []
  for (const server of servers) {
    buffers.push({ serverId: server.id, channelId: null })
    for (const channel of server.channels) {
      buffers.push({ serverId: server.id, channelId: channel.id })
    }
    for (const pm of server.privateChats) {
      buffers.push({ serverId: server.id, channelId: pm.id })
    }
  }
  return buffers
}

function findCurrentBufferIndex(
  buffers: BufferEntry[],
  currentServerId: string | null,
  currentChannelId: string | null
): number {
  if (!currentServerId) return -1
  return buffers.findIndex(
    (b) => b.serverId === currentServerId && b.channelId === currentChannelId
  )
}

function applyBuffer(state: AppStore, buffer: BufferEntry) {
  state.setCurrentServer(buffer.serverId)
  state.setCurrentChannel(buffer.channelId)
}

export function registerChannelActions(registry: ActionRegistry<AppStore>) {
  // Join channel
  registry.register({
    id: 'channel.join',
    label: 'Join Channel',
    description: 'Join an IRC channel',
    category: 'channel',
    keybinding: ':join',
    keywords: ['join', 'channel', 'enter'],
    priority: 100,

    isEnabled: (ctx) => {
      return !!ctx.currentServer?.isConnected
    },

    isVisible: (ctx) => {
      return !!ctx.currentServer
    },

    execute: async (ctx: ActionContext<AppStore>, channelName?: string) => {
      const { store, ircClient, currentServer } = ctx
      if (!ircClient || !currentServer) {
        throw new Error('No server connected')
      }

      if (!channelName) {
        // Open join channel modal
        store.openModal('join-channel')
        return
      }

      // Ensure channel name starts with #
      const normalizedChannelName = channelName.startsWith('#') ? channelName : `#${channelName}`

      // Check if we're already in this channel
      const existingChannel = currentServer.channels.find(
        (c) => c.name.toLowerCase() === normalizedChannelName.toLowerCase()
      )

      if (existingChannel) {
        // Already in the channel, just switch to it
        store.setCurrentChannel(existingChannel.id)
        return
      }

      // Join the channel using IRC client
      const ircChannel = ircClient.joinChannel(currentServer.id, normalizedChannelName)

      // Map ObsidianIRC Channel to our Channel type
      const channel = {
        id: ircChannel.id,
        name: ircChannel.name,
        serverId: currentServer.id,
        topic: '',
        users: [],
        messages: [],
        unreadCount: 0,
        isPrivate: false,
        isMentioned: false,
      }

      // Add channel to store (critical: IRC client doesn't sync to store automatically)
      store.addChannel(currentServer.id, channel)

      // Switch to the newly joined channel
      store.setCurrentChannel(channel.id)
    },
  })

  // Part (leave) channel
  registry.register({
    id: 'channel.part',
    label: 'Leave Channel',
    description: 'Leave the current IRC channel',
    category: 'channel',
    keybinding: ':part',
    keywords: ['leave', 'part', 'exit', 'channel'],
    priority: 90,

    isEnabled: (ctx) => {
      return !!ctx.currentChannel && !ctx.currentChannel.isPrivate
    },

    isVisible: (ctx) => {
      return !!ctx.currentChannel
    },

    execute: async (ctx: ActionContext<AppStore>) => {
      const { store, ircClient, currentServer, currentChannel } = ctx
      if (!ircClient || !currentServer || !currentChannel) {
        throw new Error('No channel selected')
      }

      // Leave the channel
      ircClient.leaveChannel(currentServer.id, currentChannel.name)

      // Remove channel from store
      store.removeChannel(currentServer.id, currentChannel.id)

      // Clear current channel
      store.setCurrentChannel(null)
    },
  })

  // Get channel topic
  registry.register({
    id: 'channel.topic.get',
    label: 'Get Channel Topic',
    description: 'Request the current channel topic',
    category: 'channel',
    keybinding: ':topic',
    keywords: ['topic', 'get', 'show'],
    priority: 80,

    isEnabled: (ctx) => {
      return !!ctx.currentChannel && !ctx.currentChannel.isPrivate
    },

    isVisible: (ctx) => {
      return !!ctx.currentChannel && !ctx.currentChannel.isPrivate
    },

    execute: async (ctx: ActionContext<AppStore>) => {
      const { ircClient, currentServer, currentChannel } = ctx
      if (!ircClient || !currentServer || !currentChannel) {
        throw new Error('No channel selected')
      }

      // Request topic
      ircClient.getTopic(currentServer.id, currentChannel.name)
    },
  })

  // Set channel topic
  registry.register({
    id: 'channel.topic.set',
    label: 'Set Channel Topic',
    description: 'Set a new topic for the current channel',
    category: 'channel',
    keybinding: ':topic-set',
    keywords: ['topic', 'set', 'change', 'edit'],
    priority: 75,

    isEnabled: (ctx) => {
      return !!ctx.currentChannel && !ctx.currentChannel.isPrivate
    },

    isVisible: (ctx) => {
      return !!ctx.currentChannel && !ctx.currentChannel.isPrivate
    },

    execute: async (ctx: ActionContext<AppStore>, newTopic?: string) => {
      const { store, ircClient, currentServer, currentChannel } = ctx
      if (!ircClient || !currentServer || !currentChannel) {
        throw new Error('No channel selected')
      }

      if (!newTopic) {
        // Open set topic modal
        store.openModal('set-topic')
        return
      }

      // Set the new topic
      ircClient.setTopic(currentServer.id, currentChannel.name, newTopic)
    },
  })

  // Switch to next buffer (server, channel, PM — across all servers)
  registry.register({
    id: 'buffer.next',
    label: 'Next Buffer',
    description: 'Switch to the next buffer',
    category: 'navigation',
    keybinding: 'alt+n',
    keywords: ['next', 'buffer', 'channel', 'switch'],
    priority: 90,

    isEnabled: () => true,
    isVisible: () => false,

    execute: async (ctx: ActionContext<AppStore>) => {
      const { store } = ctx
      const state = store
      const buffers = getBufferList(state.servers)
      if (buffers.length === 0) return

      const currentIdx = findCurrentBufferIndex(
        buffers,
        state.currentServerId,
        state.currentChannelId
      )
      const nextIdx = (currentIdx + 1) % buffers.length
      applyBuffer(state, buffers[nextIdx]!)
    },
  })

  // Switch to previous buffer
  registry.register({
    id: 'buffer.prev',
    label: 'Previous Buffer',
    description: 'Switch to the previous buffer',
    category: 'navigation',
    keybinding: 'alt+p',
    keywords: ['previous', 'prev', 'buffer', 'channel', 'switch'],
    priority: 90,

    isEnabled: () => true,
    isVisible: () => false,

    execute: async (ctx: ActionContext<AppStore>) => {
      const { store } = ctx
      const state = store
      const buffers = getBufferList(state.servers)
      if (buffers.length === 0) return

      const currentIdx = findCurrentBufferIndex(
        buffers,
        state.currentServerId,
        state.currentChannelId
      )
      const prevIdx = currentIdx <= 0 ? buffers.length - 1 : currentIdx - 1
      applyBuffer(state, buffers[prevIdx]!)
    },
  })

  // Alt+1 through Alt+9, Alt+0 — jump to buffer by number
  const numberKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
  for (const numKey of numberKeys) {
    const bufferIndex = numKey === '0' ? 9 : Number(numKey) - 1
    registry.register({
      id: `buffer.goto.${numKey}`,
      label: `Go to Buffer ${numKey}`,
      description: `Switch to buffer ${numKey}`,
      category: 'navigation',
      keybinding: `alt+${numKey}`,
      keywords: ['buffer', 'goto', numKey],
      priority: 85,

      isEnabled: () => true,
      isVisible: () => false,

      execute: async (ctx: ActionContext<AppStore>) => {
        const { store } = ctx
        const state = store
        const buffers = getBufferList(state.servers)
        const target = buffers[bufferIndex]
        if (target) {
          applyBuffer(state, target)
        }
      },
    })
  }

  // Mark channel as read
  registry.register({
    id: 'channel.markAsRead',
    label: 'Mark as Read',
    description: 'Mark the current channel as read',
    category: 'channel',
    keybinding: 'ctrl+r',
    keywords: ['mark', 'read', 'clear', 'unread'],
    priority: 70,

    isEnabled: (ctx) => {
      return !!ctx.currentChannel && ctx.currentChannel.unreadCount > 0
    },

    isVisible: (ctx) => {
      return !!ctx.currentChannel
    },

    execute: async (ctx: ActionContext<AppStore>) => {
      const { store, currentServer, currentChannel } = ctx
      if (!currentServer || !currentChannel) {
        return
      }

      store.updateChannel(currentServer.id, currentChannel.id, {
        unreadCount: 0,
        isMentioned: false,
      })
    },
  })
}
