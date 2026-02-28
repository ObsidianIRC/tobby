import type { StateCreator } from 'zustand'
import type { IRCClient, EventMap } from '@/utils/ircClient'
import type { AppStore } from '@/store'
import type { User } from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { stripIrcFormatting } from '@irc/messageFormatter'
import { getDatabase } from '@/services/database'
import { createMessage } from '@/utils/messageFactory'

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
  startKeepalive: (serverId: string) => void
  scheduleReconnect: (serverId: string) => void
}

// Module-level timer storage to avoid storing timers in Zustand state
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>()

// Servers for which auto-reconnect is suppressed (explicit user disconnect).
export const noAutoReconnectServers = new Set<string>()

interface KeepaliveState {
  pingInterval: ReturnType<typeof setInterval> | null
  pongTimeout: ReturnType<typeof setTimeout> | null
  reconnectTimeout: ReturnType<typeof setTimeout> | null
  reconnectAttempts: number
}

const keepaliveState = new Map<string, KeepaliveState>()
const PING_INTERVAL_MS = 30_000
const PONG_TIMEOUT_MS = 30_000
const TYPING_TIMEOUT_MS = 30_000
// Backoff delays for successive reconnect attempts (ms)
const RECONNECT_DELAYS_MS = [3_000, 6_000, 12_000, 24_000, 30_000]

function getOrCreateKeepalive(serverId: string): KeepaliveState {
  if (!keepaliveState.has(serverId)) {
    keepaliveState.set(serverId, {
      pingInterval: null,
      pongTimeout: null,
      reconnectTimeout: null,
      reconnectAttempts: 0,
    })
  }
  return keepaliveState.get(serverId)!
}

function stopKeepaliveForServer(serverId: string): void {
  const state = keepaliveState.get(serverId)
  if (!state) return
  if (state.pingInterval) clearInterval(state.pingInterval)
  if (state.pongTimeout) clearTimeout(state.pongTimeout)
  state.pingInterval = null
  state.pongTimeout = null
}

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
      }, TYPING_TIMEOUT_MS)
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
      addMessage(serverId, createMessage('system', content, 'server', serverId, serverId))
    }

    // Connection events
    ircClient.on('ready', (data: EventMap['ready']) => {
      const { updateServer, getServer, addChannel } = get()
      updateServer(data.serverId, {
        isConnected: true,
        connectionState: 'connected',
        nickname: data.nickname,
      })
      addServerMessage(data.serverId, `Registered on server as ${data.nickname}`)

      // Successful (re)connection — reset reconnect state and start keepalive.
      noAutoReconnectServers.delete(data.serverId)
      const ks = getOrCreateKeepalive(data.serverId)
      if (ks.reconnectTimeout) {
        clearTimeout(ks.reconnectTimeout)
        ks.reconnectTimeout = null
      }
      ks.reconnectAttempts = 0
      get().startKeepalive(data.serverId)

      // Auto-join channels — same flow as channelActions.ts.
      // Joining here (on IRC 001) is reliable: the socket is open and registered.
      const db = getDatabase()
      const autoJoinChannels = db.getAutoJoinChannels(data.serverId)
      const server = getServer(data.serverId)
      for (const ch of autoJoinChannels) {
        const ircCh = ircClient.joinChannel(data.serverId, ch.name)
        if (!ircCh) continue
        // If the channel is already in the store (loaded from DB), no need to add it again.
        // NAMES events will populate users once the JOIN is confirmed by the server.
        const existing = server?.channels.find((c) => c.name === ch.name)
        if (!existing) {
          // Mirror channelActions.ts: add to store with the IRC client's deterministic ID
          addChannel(data.serverId, {
            id: ircCh.id,
            name: ircCh.name,
            serverId: data.serverId,
            topic: '',
            users: [],
            messages: [],
            unreadCount: 0,
            isPrivate: false,
            isMentioned: false,
          })
        }
      }
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

    // Socket-level disconnect — schedule auto-reconnect unless suppressed.
    ;(ircClient as any).on('disconnect', (data: { serverId: string }) => {
      debugLog?.(`[Store] disconnect: ${data.serverId}`)
      stopKeepaliveForServer(data.serverId)
      ircClient.offPong(data.serverId)
      if (!noAutoReconnectServers.has(data.serverId)) {
        get().scheduleReconnect(data.serverId)
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

    // currentChannelId is global — it has no server affiliation. When the user is connected to
    // multiple servers, using it as a routing target without this check would put messages from
    // server B into whatever buffer happens to be open on server A.
    const channelBelongsToServer = (serverId: string, channelId: string | null): boolean => {
      if (!channelId) return false
      if (channelId === serverId) return true
      const srv = get().getServer(serverId)
      if (!srv) return false
      return (
        srv.channels.some((c) => c.id === channelId) ||
        srv.privateChats.some((pc) => pc.id === channelId)
      )
    }

    // WHOIS responses go to whichever buffer the user is looking at, so they're immediately visible.
    const addWhoisLine = (serverId: string, text: string) => {
      const { addMessage } = get()
      const currentChannelId = get().currentChannelId
      const targetId =
        (channelBelongsToServer(serverId, currentChannelId) ? currentChannelId : null) ?? serverId
      addMessage(targetId, createMessage('system', text, 'server', targetId, serverId))
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

      const message = createMessage(type, content, data.sender, channel.id, data.serverId, {
        msgid: data.mtags?.msgid,
        timestamp: data.timestamp,
        replyMessage,
        tags: data.mtags,
      })

      addMessage(channel.id, message)

      // account-tag: update sender's account status when the tag is present
      const tagAccount = data.mtags?.['account']
      if (tagAccount !== undefined) {
        const { updateUserAccount } = get()
        updateUserAccount(data.serverId, data.sender, tagAccount || undefined)
      }

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

        const message = createMessage('whisper', content, data.sender, channel.id, data.serverId, {
          msgid: data.mtags?.msgid,
          timestamp: data.timestamp,
          tags: data.mtags,
        })
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

      const message = createMessage(
        msgType,
        msgContent,
        data.sender,
        privateChat.id,
        data.serverId,
        {
          msgid: data.mtags?.msgid,
          timestamp: data.timestamp,
          replyMessage: pmReplyMessage,
          tags: data.mtags,
        }
      )

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

    // NOTICE from a user/service (e.g. NickServ, ChanServ, or another user)
    ircClient.on('USERNOTICE', (data: EventMap['USERNOTICE']) => {
      const { getServer, addMessage } = get()
      const server = getServer(data.serverId)
      if (!server) return

      // Server NOTICEs (e.g. ":irc.libera.chat NOTICE you :*** Checking Ident") have a hostname
      // as the sender rather than a nick. ircClient.ts already routes those to the server buffer
      // via serverMessage, so skip them here to avoid duplicates.
      const isServerOrigin = data.sender.includes('.') && !data.sender.includes('!')
      if (isServerOrigin) return

      // Prefer the sender's open PM window; fall back to whichever buffer is active on this
      // server, or the server buffer itself if the user is currently looking at another network.
      const existingPm = server.privateChats.find(
        (pc) => pc.username.toLowerCase() === data.sender.toLowerCase()
      )
      const currentChannelId = get().currentChannelId
      const targetId =
        existingPm?.id ??
        (channelBelongsToServer(data.serverId, currentChannelId) ? currentChannelId : null) ??
        data.serverId

      addMessage(
        targetId,
        createMessage(
          'notice',
          stripIrcFormatting(data.message),
          data.sender,
          targetId,
          data.serverId,
          {
            timestamp: data.timestamp,
          }
        )
      )
    })

    // NOTICE targeted at a channel
    ircClient.on('CHANNNOTICE', (data: EventMap['CHANNNOTICE']) => {
      const { getServer, addMessage } = get()
      const server = getServer(data.serverId)
      if (!server) return

      const channel = server.channels.find(
        (c) => c.name.toLowerCase() === data.channelName.toLowerCase()
      )
      if (!channel) return

      addMessage(
        channel.id,
        createMessage(
          'notice',
          stripIrcFormatting(data.message),
          data.sender,
          channel.id,
          data.serverId,
          { timestamp: data.timestamp }
        )
      )
    })

    // User join
    ircClient.on('JOIN', (data: EventMap['JOIN']) => {
      const { getServer, updateChannel } = get()
      const server = getServer(data.serverId)
      if (!server) return

      const channel = server.channels.find((c) => c.name === data.channelName)
      if (!channel) return

      // Historical events (chathistory batch replays) must NOT touch the live user list.
      // A historical self-JOIN would otherwise clear the users that 353 NAMES just populated.
      if (!data.batchTag) {
        if (data.username === server.nickname) {
          // Real self-join: clear users so the incoming 353/NAMES events populate it cleanly
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
      }

      // Add system message
      const { addMessage } = get()
      addMessage(
        channel.id,
        createMessage(
          'join',
          `${data.username} has joined ${data.channelName}`,
          data.username,
          channel.id,
          data.serverId,
          { timestamp: ircClient.getLastMessageTime(data.serverId) }
        )
      )
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
        addMessage(
          channel.id,
          createMessage(
            'part',
            `${data.username} has left ${data.channelName}${data.reason ? ` (${data.reason})` : ''}`,
            data.username,
            channel.id,
            data.serverId,
            { timestamp: ircClient.getLastMessageTime(data.serverId) }
          )
        )
      }
    })

    // User quit
    ircClient.on('QUIT', (data: EventMap['QUIT']) => {
      const { getServer, updateChannel, addMessage } = get()
      const server = getServer(data.serverId)
      if (!server) return

      // Historical QUIT events (from chathistory batch) must not touch the live user list
      for (const channel of server.channels) {
        const userInChannel = channel.users.find((u) => u.username === data.username)

        if (!data.batchTag && userInChannel) {
          updateChannel(data.serverId, channel.id, {
            users: channel.users.filter((u) => u.username !== data.username),
          })
        }

        // Only show the quit message in channels the user was actually in
        if (userInChannel) {
          addMessage(
            channel.id,
            createMessage(
              'quit',
              `${data.username} has quit${data.reason ? ` (${data.reason})` : ''}`,
              data.username,
              channel.id,
              data.serverId,
              { timestamp: ircClient.getLastMessageTime(data.serverId) }
            )
          )
        }
      }
    })

    // Account login/logout (account-notify)
    ircClient.onAccount((data) => {
      const { updateUserAccount } = get()
      updateUserAccount(data.serverId, data.nick, data.account)
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
          addMessage(
            channel.id,
            createMessage(
              'nick',
              `${data.oldNick} is now known as ${data.newNick}`,
              data.oldNick,
              channel.id,
              data.serverId
            )
          )
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
      addMessage(
        channel.id,
        createMessage(
          'kick',
          `${data.target} was kicked by ${data.username}${data.reason ? ` (${data.reason})` : ''}`,
          data.username,
          channel.id,
          data.serverId
        )
      )
    })

    // Incoming INVITE (someone invited us, or invite-notify of someone else being invited)
    ircClient.on('INVITE', (data: EventMap['INVITE']) => {
      const { getServer, addMessage } = get()
      const server = getServer(data.serverId)
      if (!server) return

      const isForUs = data.target.toLowerCase() === server.nickname.toLowerCase()

      if (isForUs) {
        // Show in whichever buffer the user is currently looking at so it's immediately visible
        const currentChannelId = get().currentChannelId
        const targetId =
          (channelBelongsToServer(data.serverId, currentChannelId) ? currentChannelId : null) ??
          data.serverId
        addMessage(
          targetId,
          createMessage('invite', data.channel, data.inviter, targetId, data.serverId)
        )
      } else {
        // invite-notify: someone else was invited — quieter system message in server buffer
        addServerMessage(data.serverId, `${data.inviter} invited ${data.target} to ${data.channel}`)
      }
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

        const message = createMessage(type, content, data.sender, buffer.id, data.serverId, {
          msgid: data.mtags?.msgid,
          multilineMessageIds: data.messageIds,
          isMultiline: true,
          lines: data.lines,
          timestamp: data.timestamp,
          replyMessage,
          tags: data.mtags,
        })

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
      const { getServer, addMessage, updateChannel } = get()
      const server = getServer(data.serverId)
      if (!server) return

      // Check if this is a channel mode change
      if (data.target.startsWith('#')) {
        const channel = server.channels.find((c) => c.name === data.target)
        if (!channel) return

        // Add system message
        addMessage(
          channel.id,
          createMessage(
            'mode',
            `${data.sender} sets mode ${data.modestring} ${data.modeargs.join(' ')}`,
            data.sender,
            channel.id,
            data.serverId
          )
        )

        // Apply prefix mode changes to the user list.
        // Prefix modes (q/a/o/h/v) each consume one nick argument.
        // Other common modes that take arguments are listed in PARAM_MODES so we
        // skip their arguments without treating them as nicks.
        const PREFIX_MODES: Record<string, string> = {
          q: '~',
          a: '&',
          o: '@',
          h: '%',
          v: '+',
        }
        // Non-prefix modes that take an argument on both + and -
        const PARAM_MODES = new Set(['b', 'e', 'I', 'k', 'f'])
        // Non-prefix modes that take an argument only on +
        const PLUS_PARAM_MODES = new Set(['l', 'j', 'J'])

        let adding = true
        let argIndex = 0
        const updatedUsers = channel.users.map((u) => ({ ...u }))
        let changed = false

        for (const char of data.modestring) {
          if (char === '+') {
            adding = true
            continue
          }
          if (char === '-') {
            adding = false
            continue
          }

          const symbol = PREFIX_MODES[char]
          if (symbol !== undefined) {
            const nick = data.modeargs[argIndex++]
            if (!nick) continue
            const idx = updatedUsers.findIndex(
              (u) => (u.nickname || u.username).toLowerCase() === nick.toLowerCase()
            )
            if (idx !== -1) {
              const u = updatedUsers[idx]!
              const cur = u.status ?? ''
              if (adding && !cur.includes(symbol)) {
                u.status = cur + symbol
                changed = true
              } else if (!adding && cur.includes(symbol)) {
                u.status = cur.replace(symbol, '')
                changed = true
              }
            }
          } else if (PARAM_MODES.has(char) || (PLUS_PARAM_MODES.has(char) && adding)) {
            argIndex++ // consume argument without using it
          }
        }

        if (changed) {
          updateChannel(data.serverId, channel.id, { users: updatedUsers })
        }
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

  startKeepalive: (serverId) => {
    const { ircClient } = get()
    if (!ircClient) return

    stopKeepaliveForServer(serverId)
    const state = getOrCreateKeepalive(serverId)

    ircClient.onPong(serverId, () => {
      debugLog?.(`[Keepalive] PONG received for ${serverId}`)
      if (state.pongTimeout) {
        clearTimeout(state.pongTimeout)
        state.pongTimeout = null
      }
    })

    state.pingInterval = setInterval(() => {
      const server = get().servers.find((s) => s.id === serverId)
      if (!server?.isConnected) return
      debugLog?.(`[Keepalive] Sending PING to ${serverId}`)
      ircClient.sendRaw(serverId, `PING :tobby-${Date.now()}`)
      if (state.pongTimeout) clearTimeout(state.pongTimeout)
      state.pongTimeout = setTimeout(() => {
        debugLog?.(`[Keepalive] PONG timeout for ${serverId}, triggering reconnect`)
        stopKeepaliveForServer(serverId)
        ircClient.offPong(serverId)
        if (!noAutoReconnectServers.has(serverId)) {
          get().scheduleReconnect(serverId)
        }
      }, PONG_TIMEOUT_MS)
    }, PING_INTERVAL_MS)
  },

  scheduleReconnect: (serverId) => {
    const state = getOrCreateKeepalive(serverId)
    // Don't double-schedule
    if (state.reconnectTimeout) return

    const { servers, clearMessages, updateServer, addMessage } = get()
    const server = servers.find((s) => s.id === serverId)
    if (!server) return

    const delay =
      RECONNECT_DELAYS_MS[Math.min(state.reconnectAttempts, RECONNECT_DELAYS_MS.length - 1)]!
    state.reconnectAttempts++

    // Clear channel buffers so chathistory loads fresh after reconnect
    for (const ch of server.channels) clearMessages(ch.id)
    for (const pc of server.privateChats) clearMessages(pc.id)
    clearMessages(serverId)

    updateServer(serverId, { isConnected: false, connectionState: 'reconnecting' })

    addMessage(
      serverId,
      createMessage(
        'system',
        `Connection lost. Reconnecting in ${Math.round(delay / 1000)}s\u2026`,
        'server',
        serverId,
        serverId
      )
    )

    state.reconnectTimeout = setTimeout(async () => {
      state.reconnectTimeout = null
      const { ircClient, servers: current } = get()
      if (!ircClient) return
      const srv = current.find((s) => s.id === serverId)
      if (!srv) return
      debugLog?.(`[Reconnect] Attempt ${state.reconnectAttempts} for ${srv.host}:${srv.port}`)
      try {
        await ircClient.connect(
          srv.name,
          srv.host,
          srv.port,
          srv.nickname,
          srv.password,
          srv.saslUsername,
          srv.saslPassword,
          srv.id
        )
      } catch {
        get().scheduleReconnect(serverId)
      }
    }, delay)
  },
})
