import type { ActionContext } from '@/types'
import type { AppStore } from '@/store'
import type { ActionRegistry } from '@/actions'

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
      const normalizedChannelName = channelName.startsWith('#')
        ? channelName
        : `#${channelName}`

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
      const channel = ircClient.joinChannel(currentServer.id, normalizedChannelName)

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

  // Switch to next channel
  registry.register({
    id: 'channel.next',
    label: 'Next Channel',
    description: 'Switch to the next channel',
    category: 'navigation',
    keybinding: 'ctrl+n',
    keywords: ['next', 'channel', 'switch'],
    priority: 90,

    isEnabled: (ctx) => {
      return !!ctx.currentServer && ctx.currentServer.channels.length > 0
    },

    isVisible: () => true,

    execute: async (ctx: ActionContext<AppStore>) => {
      const { store, currentServer, currentChannel } = ctx
      if (!currentServer || currentServer.channels.length === 0) {
        return
      }

      const channels = currentServer.channels
      const currentIndex = currentChannel
        ? channels.findIndex((c) => c.id === currentChannel.id)
        : -1

      const nextIndex = (currentIndex + 1) % channels.length
      const nextChannel = channels[nextIndex]
      if (nextChannel) {
        store.setCurrentChannel(nextChannel.id)
      }
    },
  })

  // Switch to previous channel
  registry.register({
    id: 'channel.prev',
    label: 'Previous Channel',
    description: 'Switch to the previous channel',
    category: 'navigation',
    keybinding: 'ctrl+p',
    keywords: ['previous', 'prev', 'channel', 'switch'],
    priority: 90,

    isEnabled: (ctx) => {
      return !!ctx.currentServer && ctx.currentServer.channels.length > 0
    },

    isVisible: () => true,

    execute: async (ctx: ActionContext<AppStore>) => {
      const { store, currentServer, currentChannel } = ctx
      if (!currentServer || currentServer.channels.length === 0) {
        return
      }

      const channels = currentServer.channels
      const currentIndex = currentChannel
        ? channels.findIndex((c) => c.id === currentChannel.id)
        : -1

      const prevIndex = currentIndex <= 0 ? channels.length - 1 : currentIndex - 1
      const prevChannel = channels[prevIndex]
      if (prevChannel) {
        store.setCurrentChannel(prevChannel.id)
      }
    },
  })

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
