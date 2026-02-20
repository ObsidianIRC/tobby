import type { StateCreator } from 'zustand'
import type { IRCClient, EventMap } from '@/utils/ircClient'
import type { AppStore } from '@/store'
import type { Message, User } from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { stripIrcFormatting } from '@irc/messageFormatter'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function nickMentioned(text: string, nickname: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(nickname)}\\b`, 'i')
  return pattern.test(text)
}

export interface IRCSlice {
  ircClient: IRCClient | null
  typingUsers: Record<string, string[]>
  setTypingUser: (channelId: string, nick: string) => void
  clearTypingUser: (channelId: string, nick: string) => void
  initializeIRC: () => void
  setupEventHandlers: () => void
}

// Module-level timer storage to avoid storing timers in Zustand state
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>()

interface PendingReaction {
  channelId: string
  emoji: string
  userId: string
  isUnreact: boolean
}
// Keyed by target message msgid. Cleared when applied or on batch end.
const pendingHistoryReactions = new Map<string, PendingReaction[]>()

export const createIRCSlice: StateCreator<AppStore, [], [], IRCSlice> = (set, get) => ({
  ircClient: null,
  typingUsers: {},

  setTypingUser: (channelId, nick) => {
    const key = `${channelId}:${nick}`
    const existing = typingTimers.get(key)
    if (existing) clearTimeout(existing)

    set((state) => {
      const current = state.typingUsers[channelId] ?? []
      if (current.includes(nick)) return state
      return { typingUsers: { ...state.typingUsers, [channelId]: [...current, nick] } }
    })

    typingTimers.set(
      key,
      setTimeout(() => {
        get().clearTypingUser(channelId, nick)
      }, 30000)
    )
  },

  clearTypingUser: (channelId, nick) => {
    const key = `${channelId}:${nick}`
    const existing = typingTimers.get(key)
    if (existing) {
      clearTimeout(existing)
      typingTimers.delete(key)
    }
    set((state) => {
      const current = state.typingUsers[channelId] ?? []
      const filtered = current.filter((n) => n !== nick)
      if (filtered.length === current.length) return state
      return { typingUsers: { ...state.typingUsers, [channelId]: filtered } }
    })
  },

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

    const addServerMessage = (serverId: string, content: string) => {
      const { addMessage } = get()
      const message: Message = {
        id: uuidv4(),
        type: 'system',
        content,
        timestamp: new Date(),
        userId: 'server',
        channelId: serverId,
        serverId,
        reactions: [],
        replyMessage: null,
        mentioned: [],
      }
      addMessage(serverId, message)
    }

    // Connection events
    ircClient.on('ready', (data: EventMap['ready']) => {
      const { updateServer } = get()
      updateServer(data.serverId, {
        isConnected: true,
        connectionState: 'connected',
        nickname: data.nickname,
      })
      addServerMessage(data.serverId, `Registered on server as ${data.nickname}`)
    })

    ircClient.on('connectionStateChange', (data: EventMap['connectionStateChange']) => {
      debugLog?.(`[Store] connectionStateChange: ${data.serverId} -> ${data.connectionState}`)
      const { updateServer } = get()
      const isConnected = data.connectionState === 'connected'
      updateServer(data.serverId, {
        connectionState: data.connectionState,
        isConnected,
      })
      if (data.connectionState === 'connected') {
        addServerMessage(data.serverId, 'Connected to server')
      } else if (data.connectionState === 'disconnected') {
        addServerMessage(data.serverId, 'Disconnected from server')
      }
    })

    // Raw server messages (numeric replies, server NOTICEs)
    ;(ircClient as any).on(
      'serverMessage',
      (data: { serverId: string; command: string; text: string }) => {
        // 482: not a channel operator — surface in open modal if applicable
        if (data.command === '482' && get().activeModal) {
          get().setModalError(data.text)
          return
        }
        addServerMessage(data.serverId, `[${data.command}] ${data.text}`)
      }
    )

    // WHOIS responses — route to the currently active buffer so they're visible
    const addWhoisLine = (serverId: string, text: string) => {
      const { addMessage } = get()
      const targetId = get().currentChannelId ?? serverId
      addMessage(targetId, {
        id: uuidv4(),
        type: 'system',
        content: text,
        timestamp: new Date(),
        userId: 'server',
        channelId: targetId,
        serverId,
        reactions: [],
        replyMessage: null,
        mentioned: [],
      })
    }

    ircClient.on('WHOIS_USER', (data: EventMap['WHOIS_USER']) => {
      addWhoisLine(
        data.serverId,
        `[whois] ${data.nick} (${data.username}@${data.host}) · ${data.realname}`
      )
    })
    ircClient.on('WHOIS_SERVER', (data: EventMap['WHOIS_SERVER']) => {
      addWhoisLine(data.serverId, `[whois] ${data.nick} via ${data.server} · ${data.serverInfo}`)
    })
    ircClient.on('WHOIS_IDLE', (data: EventMap['WHOIS_IDLE']) => {
      const mins = Math.floor(data.idle / 60)
      const secs = data.idle % 60
      const signon = new Date(data.signon * 1000).toLocaleString()
      addWhoisLine(
        data.serverId,
        `[whois] ${data.nick} idle ${mins}m ${secs}s · signed on ${signon}`
      )
    })
    ircClient.on('WHOIS_CHANNELS', (data: EventMap['WHOIS_CHANNELS']) => {
      addWhoisLine(data.serverId, `[whois] ${data.nick} channels: ${data.channels}`)
    })
    ircClient.on('WHOIS_ACCOUNT', (data: EventMap['WHOIS_ACCOUNT']) => {
      addWhoisLine(data.serverId, `[whois] ${data.nick} logged in as ${data.account}`)
    })
    ircClient.on('WHOIS_SECURE', (data: EventMap['WHOIS_SECURE']) => {
      addWhoisLine(data.serverId, `[whois] ${data.nick}: ${data.message}`)
    })
    ircClient.on('WHOIS_SPECIAL', (data: EventMap['WHOIS_SPECIAL']) => {
      addWhoisLine(data.serverId, `[whois] ${data.nick}: ${data.message}`)
    })
    ircClient.on('WHOIS_BOT', (data: EventMap['WHOIS_BOT']) => {
      addWhoisLine(data.serverId, `[whois] ${data.nick}: ${data.message}`)
    })
    ircClient.on('WHOIS_END', (data: EventMap['WHOIS_END']) => {
      addWhoisLine(data.serverId, `[whois] End of WHOIS for ${data.nick}`)
    })

    // Sync negotiated capabilities to store and kick off SASL if needed
    ircClient.on('CAP ACK', (data: EventMap['CAP ACK']) => {
      const { getServer, updateServer } = get()
      const server = getServer(data.serverId)
      if (!server) return
      const caps = data.cliCaps.split(' ').filter(Boolean)
      const merged = [...new Set([...(server.capabilities || []), ...caps])]
      updateServer(data.serverId, { capabilities: merged })

      // If the server acknowledged `sasl` and this server has SASL credentials, start
      // the AUTHENTICATE handshake.  The base class already holds CAP END until SASL
      // completes (903/904), so we only need to send the mechanism request here.
      if (
        caps.some((c) => c.split('=')[0] === 'sasl') &&
        server.saslUsername &&
        server.saslPassword
      ) {
        ircClient.sendRaw(data.serverId, 'AUTHENTICATE PLAIN')
      }
    })

    // Respond to AUTHENTICATE + with PLAIN credentials (saslUsername\0saslUsername\0saslPassword)
    ircClient.on('AUTHENTICATE', (data: EventMap['AUTHENTICATE']) => {
      if (data.param !== '+') return
      const server = get().getServer(data.serverId)
      if (!server?.saslUsername || !server?.saslPassword) return
      const payload = Buffer.from(
        `${server.saslUsername}\x00${server.saslUsername}\x00${server.saslPassword}`
      ).toString('base64')
      ircClient.sendRaw(data.serverId, `AUTHENTICATE ${payload}`)
    })

    // Typing notifications and reactions
    ircClient.on('TAGMSG', (data: EventMap['TAGMSG']) => {
      const { getServer, setTypingUser, clearTypingUser, updateMessage, messages } = get()
      const server = getServer(data.serverId)
      if (!server) return

      const channel = server.channels.find((c) => c.name === data.channelName)
      // For DMs the TAGMSG target is our own nick — find the private chat by the sender
      const privateChat = !channel
        ? server.privateChats.find((pc) => pc.username.toLowerCase() === data.sender.toLowerCase())
        : undefined
      const bufferTarget = channel ?? privateChat

      const typingValue = data.mtags?.['+typing']
      if (typingValue) {
        // Ignore our own typing echoes
        if (server.nickname && data.sender.toLowerCase() === server.nickname.toLowerCase()) return
        if (!bufferTarget) return

        if (typingValue === 'done') {
          clearTypingUser(bufferTarget.id, data.sender)
        } else {
          setTypingUser(bufferTarget.id, data.sender)
        }
        return
      }

      const reactEmoji = data.mtags?.['+draft/react']
      const unreactEmoji = data.mtags?.['+draft/unreact']
      const targetMsgId = data.mtags?.['+draft/reply']

      if ((reactEmoji || unreactEmoji) && targetMsgId && channel) {
        const msgs = messages.get(channel.id) ?? []
        const target = msgs.find((m) => m.msgid === targetMsgId)
        if (!target) {
          // If from a chathistory batch, defer until the message arrives
          if (data.mtags?.batch) {
            const pending = pendingHistoryReactions.get(targetMsgId) ?? []
            pending.push({
              channelId: channel.id,
              emoji: (reactEmoji ?? unreactEmoji)!,
              userId: data.sender,
              isUnreact: !!unreactEmoji,
            })
            pendingHistoryReactions.set(targetMsgId, pending)
          }
          return
        }

        const emoji = (reactEmoji ?? unreactEmoji)!
        const existing = target.reactions

        const newReactions = reactEmoji
          ? existing.some((r) => r.emoji === emoji && r.userId === data.sender)
            ? existing
            : [...existing, { emoji, userId: data.sender }]
          : existing.filter((r) => !(r.emoji === emoji && r.userId === data.sender))

        updateMessage(channel.id, target.id, { reactions: newReactions })
      }
    })

    // Channel message
    ircClient.on('CHANMSG', (data: EventMap['CHANMSG']) => {
      const { getServer, updateChannel, addMessage, clearTypingUser } = get()
      const server = getServer(data.serverId)
      if (!server) return

      const channel = server.channels.find((c) => c.name === data.channelName)
      if (!channel) return

      // Message received — sender is no longer typing
      clearTypingUser(channel.id, data.sender)

      // HistServ (and similar bots) relay TAGMSG events as plain text ("X sent a TAGMSG").
      // These are pure noise — suppress them.
      if (/\bsent a TAGMSG\b/i.test(data.message)) return

      const isAction = data.message.startsWith('\x01ACTION ') && data.message.endsWith('\x01')
      const content = isAction ? data.message.slice(8, -1) : data.message
      const type = isAction ? 'action' : 'message'

      const replyMsgId = data.mtags?.['+draft/reply']
      const replyMessage = replyMsgId
        ? ((get().messages.get(channel.id) ?? []).find((m) => m.msgid === replyMsgId) ?? null)
        : null

      const message: Message = {
        id: uuidv4(),
        msgid: data.mtags?.msgid,
        type,
        content,
        timestamp: data.timestamp,
        userId: data.sender,
        channelId: channel.id,
        serverId: data.serverId,
        reactions: [],
        replyMessage,
        mentioned: [],
        tags: data.mtags,
      }

      addMessage(channel.id, message)

      if (message.msgid) {
        const pending = pendingHistoryReactions.get(message.msgid)
        if (pending?.length) {
          pendingHistoryReactions.delete(message.msgid)
          const { updateMessage, messages: currentMsgs } = get()
          const stored = (currentMsgs.get(channel.id) ?? []).find((m) => m.msgid === message.msgid)
          if (stored) {
            let reactions = stored.reactions
            for (const r of pending) {
              const emoji = r.emoji
              if (r.isUnreact) {
                reactions = reactions.filter(
                  (ex) => !(ex.emoji === emoji && ex.userId === r.userId)
                )
              } else if (!reactions.some((ex) => ex.emoji === emoji && ex.userId === r.userId)) {
                reactions = [...reactions, { emoji, userId: r.userId }]
              }
            }
            updateMessage(channel.id, stored.id, { reactions })
          }
        }
      }

      const isHistorical = !!data.mtags?.batch
      if (!isHistorical) {
        const { currentChannelId } = get()
        const mentioned = nickMentioned(data.message, server.nickname)

        if (currentChannelId !== channel.id) {
          updateChannel(data.serverId, channel.id, {
            unreadCount: channel.unreadCount + 1,
            ...(mentioned && { isMentioned: true }),
          })
        }

        if (mentioned) {
          process.stdout.write('\x07')
        }
      }
    })

    // User message (private message/whisper)
    ircClient.on('USERMSG', (data: EventMap['USERMSG']) => {
      const { getServer, addMessage, addPrivateChat, updatePrivateChat, currentChannelId } = get()
      const server = getServer(data.serverId)
      if (!server) return

      const channelContext = data.mtags?.['+draft/channel-context']
      if (channelContext) {
        // Inline whisper — route to the channel it belongs to
        const channel = server.channels.find((c) => c.name === channelContext)
        if (!channel) return

        const cleanContent = stripIrcFormatting(data.message)
        // For an echo of our own outgoing whisper, encode the target so the
        // display can show direction (→ target: message). For incoming
        // whispers the sender is shown via userId so content stays clean.
        const isSentByUs = data.sender === server.nickname
        const content = isSentByUs ? `→ ${data.target}: ${cleanContent}` : cleanContent

        const message: Message = {
          id: uuidv4(),
          msgid: data.mtags?.msgid,
          type: 'whisper',
          content,
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

        if (currentChannelId !== channel.id) {
          const { updateChannel } = get()
          updateChannel(data.serverId, channel.id, {
            unreadCount: channel.unreadCount + 1,
            isMentioned: true,
          })
        }
        process.stdout.write('\x07')
        return
      }

      // Regular private message
      // When echo-message reflects our own outgoing PM back, sender is us and target is the recipient.
      const chatPartner =
        data.sender.toLowerCase() === server.nickname.toLowerCase() ? data.target : data.sender
      if (!chatPartner || chatPartner.toLowerCase() === server.nickname.toLowerCase()) return

      let privateChat = server.privateChats.find((pc) => pc.username === chatPartner)
      if (!privateChat) {
        privateChat = {
          id: uuidv4(),
          username: chatPartner,
          serverId: data.serverId,
          unreadCount: 0,
          isMentioned: false,
        }
        addPrivateChat(data.serverId, privateChat)
      }

      const isAction = data.message.startsWith('\x01ACTION ') && data.message.endsWith('\x01')
      const msgContent = isAction ? data.message.slice(8, -1) : data.message
      const msgType = isAction ? 'action' : 'message'

      const pmReplyMsgId = data.mtags?.['+draft/reply']
      const pmReplyMessage = pmReplyMsgId
        ? ((get().messages.get(privateChat.id) ?? []).find((m) => m.msgid === pmReplyMsgId) ?? null)
        : null

      const message: Message = {
        id: uuidv4(),
        msgid: data.mtags?.msgid,
        type: msgType,
        content: msgContent,
        timestamp: data.timestamp,
        userId: data.sender,
        channelId: privateChat.id,
        serverId: data.serverId,
        reactions: [],
        replyMessage: pmReplyMessage,
        mentioned: [],
        tags: data.mtags,
      }

      addMessage(privateChat.id, message)

      const isHistorical = !!data.mtags?.batch
      if (!isHistorical) {
        if (currentChannelId !== privateChat.id) {
          updatePrivateChat(data.serverId, privateChat.id, {
            unreadCount: privateChat.unreadCount + 1,
            isMentioned: true,
          })
        }

        process.stdout.write('\x07')
      }
    })

    // User join
    ircClient.on('JOIN', (data: EventMap['JOIN']) => {
      const { getServer, updateChannel } = get()
      const server = getServer(data.serverId)
      if (!server) return

      const channel = server.channels.find((c) => c.name === data.channelName)
      if (!channel) return

      // Self-join: clear users list so the incoming 353/NAMES events populate it cleanly
      if (data.username === server.nickname) {
        updateChannel(data.serverId, channel.id, { users: [] })
      } else {
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
      }

      // Add system message
      const { addMessage } = get()
      const message: Message = {
        id: uuidv4(),
        type: 'join',
        content: `${data.username} has joined ${data.channelName}`,
        timestamp: data.timestamp,
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
      const {
        getServer,
        updateChannel,
        addMessage,
        removeChannel,
        currentChannelId,
        setCurrentChannel,
      } = get()
      const server = getServer(data.serverId)
      if (!server) return

      const channel = server.channels.find((c) => c.name === data.channelName)
      if (!channel) return

      // Check if the user who parted is the current user (us)
      const isCurrentUser = data.username === server.nickname

      if (isCurrentUser) {
        // We left the channel, remove it entirely
        removeChannel(data.serverId, channel.id)

        // If we were viewing this channel, clear the selection
        if (currentChannelId === channel.id) {
          setCurrentChannel(null)
        }
      } else {
        // Someone else left, just remove them from the user list
        updateChannel(data.serverId, channel.id, {
          users: channel.users.filter((u) => u.username !== data.username),
        })

        // Add system message
        const message: Message = {
          id: uuidv4(),
          type: 'part',
          content: `${data.username} has left ${data.channelName}${data.reason ? ` (${data.reason})` : ''}`,
          timestamp: data.timestamp,
          userId: data.username,
          channelId: channel.id,
          serverId: data.serverId,
          reactions: [],
          replyMessage: null,
          mentioned: [],
        }
        addMessage(channel.id, message)
      }
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
            timestamp: data.timestamp,
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
      const { getServer, updateServer, updateChannel, addMessage } = get()
      const server = getServer(data.serverId)
      if (!server) return

      // If it's our own nick change, update the stored nickname (affects typing/mention checks)
      if (data.oldNick.toLowerCase() === server.nickname.toLowerCase()) {
        updateServer(data.serverId, { nickname: data.newNick })
      }

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

      // Merge with existing users — IRC sends 353 in multiple chunks; each fires a NAMES event.
      // Replacing on every chunk would discard all but the last batch.
      const existingUsernames = new Set(channel.users.map((u) => u.username))
      const toAdd = users.filter((u) => !existingUsernames.has(u.username))
      updateChannel(data.serverId, channel.id, {
        users: [...channel.users, ...toAdd],
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
      try {
        const { getServer, addMessage, clearTypingUser } = get()
        const server = getServer(data.serverId)
        if (!server) return

        const channel = data.channelName
          ? server.channels.find((c) => c.name === data.channelName)
          : undefined

        // For DMs: channelName is always undefined (base class only sets it for #channels).
        // Determine the PM partner: for incoming use sender, for our own echo use currentChannelId.
        let pmChat: (typeof server.privateChats)[number] | undefined
        if (!channel) {
          const isOurs = data.sender.toLowerCase() === server.nickname.toLowerCase()
          if (isOurs) {
            // Outgoing echo — we're still viewing the PM we just sent to
            const currentId = get().currentChannelId
            pmChat = server.privateChats.find((pc) => pc.id === currentId)
          } else {
            // Incoming DM multiline — partner is the sender
            pmChat = server.privateChats.find(
              (pc) => pc.username.toLowerCase() === data.sender.toLowerCase()
            )
            if (!pmChat) {
              const { addPrivateChat } = get()
              pmChat = {
                id: uuidv4(),
                username: data.sender,
                serverId: data.serverId,
                unreadCount: 0,
                isMentioned: false,
              }
              addPrivateChat(data.serverId, pmChat)
            }
          }
        }

        const buffer = channel ?? pmChat
        if (!buffer) return

        // Multiline message received — sender is no longer typing
        clearTypingUser(buffer.id, data.sender)

        const fullText = data.lines.join('\n')
        const isAction =
          data.lines[0]?.startsWith('\x01ACTION ') &&
          data.lines[data.lines.length - 1]?.endsWith('\x01')
        const content = isAction ? fullText.slice(8, -1) : fullText
        const type = isAction ? 'action' : 'message'

        const replyMsgId = data.mtags?.['+draft/reply']
        const replyMessage = replyMsgId
          ? ((get().messages.get(buffer.id) ?? []).find((m) => m.msgid === replyMsgId) ?? null)
          : null

        const message: Message = {
          id: uuidv4(),
          msgid: data.mtags?.msgid,
          multilineMessageIds: data.messageIds,
          isMultiline: true,
          lines: data.lines,
          type,
          content,
          timestamp: data.timestamp,
          userId: data.sender,
          channelId: buffer.id,
          serverId: data.serverId,
          reactions: [],
          replyMessage,
          mentioned: [],
          tags: data.mtags,
        }

        addMessage(buffer.id, message)

        const isHistorical = !!data.mtags?.batch
        if (!isHistorical) {
          const { currentChannelId, updateChannel } = get()
          const mentioned = nickMentioned(fullText, server.nickname)

          if (currentChannelId !== buffer.id) {
            updateChannel(data.serverId, buffer.id, {
              unreadCount: (buffer.unreadCount ?? 0) + 1,
              ...(mentioned && { isMentioned: true }),
            })
          }

          if (mentioned) {
            process.stdout.write('\x07')
          }
        }
      } catch (error) {
        debugLog?.('MULTILINE_MESSAGE handler error:', error)
      }
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

    ircClient.on('BATCH_END', (_data: EventMap['BATCH_END']) => {
      if (pendingHistoryReactions.size === 0) return
      const { messages, updateMessage } = get()
      for (const [targetMsgId, reactions] of pendingHistoryReactions) {
        for (const r of reactions) {
          const msgs = messages.get(r.channelId) ?? []
          const target = msgs.find((m) => m.msgid === targetMsgId)
          if (!target) continue
          const emoji = r.emoji
          let newReactions = target.reactions
          if (r.isUnreact) {
            newReactions = newReactions.filter(
              (ex) => !(ex.emoji === emoji && ex.userId === r.userId)
            )
          } else if (!newReactions.some((ex) => ex.emoji === emoji && ex.userId === r.userId)) {
            newReactions = [...newReactions, { emoji, userId: r.userId }]
          }
          updateMessage(r.channelId, target.id, { reactions: newReactions })
        }
        pendingHistoryReactions.delete(targetMsgId)
      }
    })
  },
})
