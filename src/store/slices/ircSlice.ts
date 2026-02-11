import type { StateCreator } from 'zustand'
import type { IRCClient, EventMap } from '@/utils/ircClient'
import type { AppStore } from '@/store'
import type { Message, User } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export interface IRCSlice {
  ircClient: IRCClient | null
  initializeIRC: () => void
  setupEventHandlers: () => void
}

export const createIRCSlice: StateCreator<AppStore, [], [], IRCSlice> = (set, get) => ({
  ircClient: null,

  initializeIRC: () => {
    // Dynamic import to avoid loading IRC client during module initialization
    const { createIRCClient } = require('@/utils/ircClient')
    const client = createIRCClient()
    set({ ircClient: client })
    get().setupEventHandlers()
  },

  setupEventHandlers: () => {
    const { ircClient } = get()
    if (!ircClient) return

    // Connection events
    ircClient.on('ready', (data: EventMap['ready']) => {
      const { updateServer } = get()
      updateServer(data.serverId, {
        isConnected: true,
        connectionState: 'connected',
      })
    })

    ircClient.on('connectionStateChange', (data: EventMap['connectionStateChange']) => {
      const { updateServer } = get()
      const isConnected = data.connectionState === 'connected'
      updateServer(data.serverId, {
        connectionState: data.connectionState,
        isConnected,
      })
    })

    // Channel message
    ircClient.on('CHANMSG', (data: EventMap['CHANMSG']) => {
      const { getServer, updateChannel, addMessage } = get()
      const server = getServer(data.serverId)
      if (!server) return

      const channel = server.channels.find((c) => c.name === data.channelName)
      if (!channel) return

      const message: Message = {
        id: uuidv4(),
        msgid: data.mtags?.msgid,
        type: 'message',
        content: data.message,
        timestamp: data.timestamp,
        userId: data.sender,
        channelId: channel.id,
        serverId: data.serverId,
        reactions: [],
        replyMessage: null,
        mentioned: [],
        tags: data.mtags,
      }

      addMessage(channel.id, message)

      // Increment unread count if channel is not focused
      const { focusedChannel } = get()
      if (focusedChannel !== channel.id) {
        updateChannel(data.serverId, channel.id, {
          unreadCount: channel.unreadCount + 1,
        })
      }
    })

    // User message (private message/whisper)
    ircClient.on('USERMSG', (data: EventMap['USERMSG']) => {
      const { getServer, addMessage } = get()
      const server = getServer(data.serverId)
      if (!server) return

      // Find or create private chat
      let privateChat = server.privateChats.find((pc) => pc.username === data.sender)
      if (!privateChat) {
        privateChat = {
          id: uuidv4(),
          username: data.sender,
          serverId: data.serverId,
          unreadCount: 0,
          isMentioned: false,
        }
        // TODO: Add addPrivateChat method to store
      }

      const message: Message = {
        id: uuidv4(),
        msgid: data.mtags?.msgid,
        type: 'message',
        content: data.message,
        timestamp: data.timestamp,
        userId: data.sender,
        channelId: privateChat.id,
        serverId: data.serverId,
        reactions: [],
        replyMessage: null,
        mentioned: [],
        tags: data.mtags,
      }

      addMessage(privateChat.id, message)
    })

    // User join
    ircClient.on('JOIN', (data: EventMap['JOIN']) => {
      const { getServer, updateChannel } = get()
      const server = getServer(data.serverId)
      if (!server) return

      const channel = server.channels.find((c) => c.name === data.channelName)
      if (!channel) return

      const user: User = {
        id: uuidv4(),
        username: data.username,
        isOnline: true,
        status: 'online',
        account: data.account,
        realname: data.realname,
      }

      updateChannel(data.serverId, channel.id, {
        users: [...channel.users, user],
      })

      // Add system message
      const { addMessage } = get()
      const message: Message = {
        id: uuidv4(),
        type: 'join',
        content: `${data.username} has joined ${data.channelName}`,
        timestamp: new Date(),
        userId: data.username,
        channelId: channel.id,
        serverId: data.serverId,
        reactions: [],
        replyMessage: null,
        mentioned: [],
      }
      addMessage(channel.id, message)
    })

    // User part
    ircClient.on('PART', (data: EventMap['PART']) => {
      const { getServer, updateChannel, addMessage } = get()
      const server = getServer(data.serverId)
      if (!server) return

      const channel = server.channels.find((c) => c.name === data.channelName)
      if (!channel) return

      updateChannel(data.serverId, channel.id, {
        users: channel.users.filter((u) => u.username !== data.username),
      })

      // Add system message
      const message: Message = {
        id: uuidv4(),
        type: 'part',
        content: `${data.username} has left ${data.channelName}${data.reason ? ` (${data.reason})` : ''}`,
        timestamp: new Date(),
        userId: data.username,
        channelId: channel.id,
        serverId: data.serverId,
        reactions: [],
        replyMessage: null,
        mentioned: [],
      }
      addMessage(channel.id, message)
    })

    // User quit
    ircClient.on('QUIT', (data: EventMap['QUIT']) => {
      const { getServer, updateChannel, addMessage } = get()
      const server = getServer(data.serverId)
      if (!server) return

      // Remove user from all channels
      for (const channel of server.channels) {
        const userInChannel = channel.users.find((u) => u.username === data.username)
        if (userInChannel) {
          updateChannel(data.serverId, channel.id, {
            users: channel.users.filter((u) => u.username !== data.username),
          })

          // Add system message
          const message: Message = {
            id: uuidv4(),
            type: 'quit',
            content: `${data.username} has quit${data.reason ? ` (${data.reason})` : ''}`,
            timestamp: new Date(),
            userId: data.username,
            channelId: channel.id,
            serverId: data.serverId,
            reactions: [],
            replyMessage: null,
            mentioned: [],
          }
          addMessage(channel.id, message)
        }
      }
    })

    // Nick change
    ircClient.on('NICK', (data: EventMap['NICK']) => {
      const { getServer, updateChannel, addMessage } = get()
      const server = getServer(data.serverId)
      if (!server) return

      // Update username in all channels
      for (const channel of server.channels) {
        const user = channel.users.find((u) => u.username === data.oldNick)
        if (user) {
          updateChannel(data.serverId, channel.id, {
            users: channel.users.map((u) =>
              u.username === data.oldNick ? { ...u, username: data.newNick } : u
            ),
          })

          // Add system message
          const message: Message = {
            id: uuidv4(),
            type: 'nick',
            content: `${data.oldNick} is now known as ${data.newNick}`,
            timestamp: new Date(),
            userId: data.oldNick,
            channelId: channel.id,
            serverId: data.serverId,
            reactions: [],
            replyMessage: null,
            mentioned: [],
          }
          addMessage(channel.id, message)
        }
      }
    })

    // Kick
    ircClient.on('KICK', (data: EventMap['KICK']) => {
      const { getServer, updateChannel, addMessage } = get()
      const server = getServer(data.serverId)
      if (!server) return

      const channel = server.channels.find((c) => c.name === data.channelName)
      if (!channel) return

      updateChannel(data.serverId, channel.id, {
        users: channel.users.filter((u) => u.username !== data.target),
      })

      // Add system message
      const message: Message = {
        id: uuidv4(),
        type: 'kick',
        content: `${data.target} was kicked by ${data.username}${data.reason ? ` (${data.reason})` : ''}`,
        timestamp: new Date(),
        userId: data.username,
        channelId: channel.id,
        serverId: data.serverId,
        reactions: [],
        replyMessage: null,
        mentioned: [],
      }
      addMessage(channel.id, message)
    })

    // Names reply
    ircClient.on('NAMES', (data: EventMap['NAMES']) => {
      const { getServer, updateChannel } = get()
      const server = getServer(data.serverId)
      if (!server) return

      const channel = server.channels.find((c) => c.name === data.channelName)
      if (!channel) return

      // Convert IRC User type to our User type
      const users: User[] = data.users.map((ircUser) => ({
        id: ircUser.id,
        username: ircUser.username,
        nickname: ircUser.displayName,
        modes: ircUser.modes ? [ircUser.modes] : undefined,
        isOnline: ircUser.isOnline,
        isAway: ircUser.isAway,
        awayMessage: ircUser.awayMessage,
        status: ircUser.status,
        account: ircUser.account,
        realname: ircUser.realname,
      }))

      updateChannel(data.serverId, channel.id, {
        users,
      })
    })

    // Topic events
    ircClient.on('TOPIC', (data: EventMap['TOPIC']) => {
      const { getServer, updateChannel } = get()
      const server = getServer(data.serverId)
      if (!server) return

      const channel = server.channels.find((c) => c.name === data.channelName)
      if (!channel) return

      updateChannel(data.serverId, channel.id, {
        topic: data.topic,
      })
    })

    ircClient.on('RPL_TOPIC', (data: EventMap['RPL_TOPIC']) => {
      const { getServer, updateChannel } = get()
      const server = getServer(data.serverId)
      if (!server) return

      const channel = server.channels.find((c) => c.name === data.channelName)
      if (!channel) return

      updateChannel(data.serverId, channel.id, {
        topic: data.topic,
      })
    })

    // Multiline message
    ircClient.on('MULTILINE_MESSAGE', (data: EventMap['MULTILINE_MESSAGE']) => {
      const { getServer, addMessage } = get()
      const server = getServer(data.serverId)
      if (!server) return

      const channel = data.channelName
        ? server.channels.find((c) => c.name === data.channelName)
        : undefined

      if (!channel) return

      const message: Message = {
        id: uuidv4(),
        msgid: data.mtags?.msgid,
        multilineMessageIds: data.messageIds,
        type: 'message',
        content: data.lines.join('\n'),
        timestamp: data.timestamp,
        userId: data.sender,
        channelId: channel.id,
        serverId: data.serverId,
        reactions: [],
        replyMessage: null,
        mentioned: [],
        tags: data.mtags,
      }

      addMessage(channel.id, message)
    })

    // Mode change
    ircClient.on('MODE', (data: EventMap['MODE']) => {
      const { getServer, addMessage } = get()
      const server = getServer(data.serverId)
      if (!server) return

      // Check if this is a channel mode change
      if (data.target.startsWith('#')) {
        const channel = server.channels.find((c) => c.name === data.target)
        if (!channel) return

        // Add system message
        const message: Message = {
          id: uuidv4(),
          type: 'mode',
          content: `${data.sender} sets mode ${data.modestring} ${data.modeargs.join(' ')}`,
          timestamp: new Date(),
          userId: data.sender,
          channelId: channel.id,
          serverId: data.serverId,
          reactions: [],
          replyMessage: null,
          mentioned: [],
        }
        addMessage(channel.id, message)
      }
    })
  },
})
