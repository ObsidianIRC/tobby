import { useRef, useEffect } from 'react'
import type React from 'react'
import { MacOSScrollAccel } from '@opentui/core'
import type { ScrollBoxRenderable } from '@opentui/core'
import { useStore } from '../../store'
import { THEME, COLORS } from '../../constants/theme'
import { renderIrcText, stripIrcFormatting } from '../../utils/ircFormatting'
import { getNicknameColor } from '../../utils/nickColors'
import type { Message } from '../../types'

const SELECTABLE_TYPES: Message['type'][] = ['message', 'action']

// [HH:MM] = 7 chars, space = 1, nick = variable, ' › ' = 3
const contentOffset = (nick: string) => 11 + nick.length

function MultilineMessageView({
  msg,
  username,
  timestamp,
  offset,
  isSelected,
}: {
  msg: Message
  username: string
  timestamp: string
  offset: number
  isSelected: boolean
}) {
  const lines = msg.lines ?? msg.content.split('\n')
  const nicknameColor = getNicknameColor(username)
  const visibleLines = isSelected ? lines : lines.slice(0, 2)
  const hiddenCount = lines.length - 2

  return (
    <box flexDirection="column">
      <text>
        <span fg={THEME.dimText}>[{timestamp}]</span>
        <span fg={nicknameColor}> {username}</span>
        <span fg={THEME.mutedText}> › </span>
        <span fg={THEME.foreground}>{visibleLines[0] ?? ''}</span>
      </text>
      {visibleLines.slice(1).map((line, i) => (
        <text key={i}>
          <span fg={THEME.foreground}>
            {' '.repeat(offset)}
            {line}
          </span>
        </text>
      ))}
      {!isSelected && hiddenCount > 0 && (
        <box paddingLeft={offset}>
          <text fg={THEME.dimText}>
            ▾ {hiddenCount} more line{hiddenCount !== 1 ? 's' : ''}
          </text>
        </box>
      )}
    </box>
  )
}

function ReplyPreview({ replyMessage, offset }: { replyMessage: Message; offset: number }) {
  const raw = stripIrcFormatting(replyMessage.content)
  const preview = raw.length > 50 ? raw.slice(0, 50) + '…' : raw
  return (
    <box paddingLeft={offset}>
      <text>
        <span fg={THEME.dimText}>↩ </span>
        <span fg={THEME.dimText}>{replyMessage.userId}</span>
        <span fg={THEME.dimText}> › </span>
        <span fg={THEME.dimText}>{preview}</span>
      </text>
    </box>
  )
}

function ReactionsRow({
  reactions,
  paddingLeft,
}: {
  reactions: Message['reactions']
  paddingLeft: number
}) {
  const grouped = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1
    return acc
  }, {})

  const parts = Object.entries(grouped)
    .map(([emoji, count]) => `${emoji} ${count}`)
    .join('  ')

  return (
    <box paddingLeft={paddingLeft}>
      <text fg={THEME.mutedText}>{parts}</text>
    </box>
  )
}

const chatScrollAccel = new MacOSScrollAccel({ maxMultiplier: 8 })

interface ChatPaneProps {
  width: number
  height: number
  focused: boolean
}

export function ChatPane({ width, height, focused }: ChatPaneProps) {
  const currentServerId = useStore((state) => state.currentServerId)
  const currentChannelId = useStore((state) => state.currentChannelId)
  const servers = useStore((state) => state.servers)
  const messages = useStore((state) => state.messages)
  const selectedMessage = useStore((state) => state.selectedMessage)
  const setSelectedMessage = useStore((state) => state.setSelectedMessage)
  const expandMultilines = useStore((state) => state.expandMultilines)

  const scrollBoxRef = useRef<ScrollBoxRenderable | null>(null)

  const currentServer = servers.find((s) => s.id === currentServerId)
  const currentChannel = currentServer?.channels.find((c) => c.id === currentChannelId)
  const currentPrivateChat = currentServer?.privateChats.find((pc) => pc.id === currentChannelId)

  const activeView = currentChannel || currentPrivateChat
  const isServerView = !activeView && !!currentServerId
  const allMessages = currentChannelId
    ? (messages.get(currentChannelId) ?? [])
    : isServerView
      ? (messages.get(currentServerId!) ?? [])
      : []

  const channelHeaderHeight = activeView || isServerView ? 2 : 0
  const topicHeight = currentChannel?.topic ? 2 : 0
  const messagesHeight = height - channelHeaderHeight - topicHeight - 2

  // Keep refs current so the effect doesn't need them in its dep array
  const allMessagesRef = useRef(allMessages)
  const messagesHeightRef = useRef(messagesHeight)
  useEffect(() => {
    allMessagesRef.current = allMessages
  }, [allMessages])
  useEffect(() => {
    messagesHeightRef.current = messagesHeight
  }, [messagesHeight])

  // Compute rendered line-height of a single message box
  const msgLineCount = (msg: Message, isSelected: boolean) => {
    let h = 1 // first line always
    if (msg.isMultiline && msg.lines && msg.lines.length > 1) {
      if (isSelected || expandMultilines) {
        h += msg.lines.length - 1 // all remaining lines visible
      } else {
        h += Math.min(msg.lines.length - 1, 1) // at most the 2nd line
        if (msg.lines.length > 2) h += 1 // chevron row
      }
    }
    if (msg.replyMessage) h += 1
    if (msg.reactions.length > 0) h += 1
    if (isSelected) h += 1 // hints row
    return h
  }

  useEffect(() => {
    const box = scrollBoxRef.current
    if (!box) return

    if (!selectedMessage) {
      // Exiting selection — snap back to live view (bottom)
      box.scrollTop = Number.MAX_SAFE_INTEGER
      return
    }

    // Defer until after opentui re-renders so the hint row is part of the layout
    // before we read/write scrollTop
    const timer = setTimeout(() => {
      const b = scrollBoxRef.current
      if (!b) return

      const msgs = allMessagesRef.current
      const viewportH = messagesHeightRef.current
      const idx = msgs.findIndex((m) => m.id === selectedMessage.id)
      if (idx === -1) return

      let startLine = 0
      for (let i = 0; i < idx; i++) {
        const m = msgs[i]
        if (m) startLine += msgLineCount(m, false)
      }
      const selHeight = msgLineCount(selectedMessage, true)
      const endLine = startLine + selHeight

      const current = b.scrollTop
      if (startLine < current) {
        b.scrollTop = startLine
      } else if (endLine > current + viewportH) {
        b.scrollTop = endLine - viewportH
      }
    }, 0)

    return () => clearTimeout(timer)
  }, [selectedMessage, messagesHeight])

  const formatTimestamp = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const formatMessage = (msg: Message) => {
    const timestamp = formatTimestamp(msg.timestamp)
    const user = currentChannel?.users.find(
      (u) => u.username === msg.userId || u.nickname === msg.userId
    )
    const username = user?.nickname || user?.username || msg.userId

    // Return object with parts for colored rendering
    return { timestamp, username, msg }
  }

  // Collect all member nicks for inline coloring — stable reference via useMemo would be ideal
  // but for a terminal app the re-render cost is negligible
  const channelUsernames = currentChannel?.users.map((u) => u.username) ?? []

  const renderMessage = (msg: Message) => {
    const { timestamp, username } = formatMessage(msg)
    const nicknameColor = getNicknameColor(username)

    switch (msg.type) {
      case 'message':
        return (
          <text>
            <span fg={THEME.dimText}>[{timestamp}]</span>
            <span fg={nicknameColor}> {username}</span>
            <span fg={THEME.mutedText}> › </span>
            <span fg={THEME.foreground}>
              {renderIrcText(msg.content, msg.id, currentServer?.nickname, channelUsernames)}
            </span>
          </text>
        )
      case 'action':
        return (
          <text>
            <span fg={THEME.dimText}>[{timestamp}]</span>
            <span fg={COLORS.magenta}> * {username}</span>
            <span fg={COLORS.magenta}>
              {' '}
              {renderIrcText(msg.content, msg.id, currentServer?.nickname, channelUsernames)}
            </span>
          </text>
        )
      case 'notice':
        return (
          <text>
            <span fg={THEME.dimText}>[{timestamp}]</span>
            <span fg={COLORS.orange}> -{username}-</span>
            <span fg={COLORS.orange}> {msg.content}</span>
          </text>
        )
      case 'join':
        return (
          <text>
            <span fg={THEME.dimText}>[{timestamp}]</span>
            <span fg={COLORS.green}> → </span>
            <span fg={nicknameColor}>{username}</span>
            <span fg={COLORS.green}> joined</span>
          </text>
        )
      case 'part':
        return (
          <text>
            <span fg={THEME.dimText}>[{timestamp}]</span>
            <span fg={COLORS.cyan}> ← </span>
            <span fg={nicknameColor}>{username}</span>
            <span fg={COLORS.cyan}> left</span>
            {msg.content && <span fg={THEME.mutedText}> ({msg.content})</span>}
          </text>
        )
      case 'quit':
        return (
          <text>
            <span fg={THEME.dimText}>[{timestamp}]</span>
            <span fg={COLORS.red}> ← </span>
            <span fg={nicknameColor}>{username}</span>
            <span fg={COLORS.red}> quit</span>
            {msg.content && <span fg={THEME.mutedText}> ({msg.content})</span>}
          </text>
        )
      case 'kick':
        return (
          <text>
            <span fg={THEME.dimText}>[{timestamp}]</span>
            <span fg={COLORS.red}> ⚠ </span>
            <span fg={nicknameColor}>{username}</span>
            <span fg={COLORS.red}> was kicked</span>
            {msg.content && <span fg={THEME.mutedText}>: {msg.content}</span>}
          </text>
        )
      case 'nick':
        return (
          <text>
            <span fg={THEME.dimText}>[{timestamp}]</span>
            <span fg={COLORS.yellow}> ⟲ </span>
            <span fg={nicknameColor}>{username}</span>
            <span fg={COLORS.yellow}> → </span>
            <span fg={getNicknameColor(msg.content)}>{msg.content}</span>
          </text>
        )
      case 'mode':
        return (
          <text>
            <span fg={THEME.dimText}>[{timestamp}]</span>
            <span fg={COLORS.blue}> ⚙ Mode: </span>
            <span fg={THEME.foreground}>{msg.content}</span>
          </text>
        )
      case 'whisper':
        return (
          <text>
            <span fg={THEME.dimText}>[{timestamp}]</span>
            <span fg={COLORS.magenta}> ✉ </span>
            <span fg={getNicknameColor(username)}>{username}</span>
            <span fg={COLORS.magenta}> › </span>
            <span fg={COLORS.magenta}>{msg.content}</span>
          </text>
        )
      case 'system':
        return (
          <text>
            <span fg={THEME.dimText}>[{timestamp}]</span>
            <span fg={THEME.mutedText}> • {msg.content}</span>
          </text>
        )
      default:
        return (
          <text>
            <span fg={THEME.dimText}>[{timestamp}]</span>
            <span fg={THEME.foreground}> {msg.content}</span>
          </text>
        )
    }
  }

  return (
    <box
      width={width}
      height={height}
      flexDirection="column"
      backgroundColor={THEME.backgroundChat}
    >
      {currentChannel && (
        <box
          height={2}
          paddingLeft={1}
          paddingTop={1}
          backgroundColor={THEME.backgroundHighlight}
          border={['bottom']}
          borderColor={THEME.borderSubtle}
        >
          <text>
            <span fg={THEME.accentPurple}># </span>
            <span fg={THEME.foreground}>{currentChannel.name}</span>
            {currentChannel.users.length > 0 && (
              <span fg={THEME.mutedText}> • {currentChannel.users.length} users</span>
            )}
          </text>
        </box>
      )}
      {!currentChannel && currentPrivateChat && (
        <box
          height={2}
          paddingLeft={1}
          paddingTop={1}
          backgroundColor={THEME.backgroundHighlight}
          border={['bottom']}
          borderColor={THEME.borderSubtle}
        >
          <text>
            <span fg={THEME.accentPink}>@ </span>
            <span fg={THEME.foreground}>{currentPrivateChat.username}</span>
          </text>
        </box>
      )}
      {isServerView && currentServer && (
        <box
          height={2}
          paddingLeft={1}
          paddingTop={1}
          backgroundColor={THEME.backgroundHighlight}
          border={['bottom']}
          borderColor={THEME.borderSubtle}
        >
          <text>
            <span fg={THEME.accentBlue}>⚡ </span>
            <span fg={THEME.foreground}>{currentServer.name}</span>
            <span fg={THEME.mutedText}> • server messages</span>
          </text>
        </box>
      )}
      {currentChannel?.topic && (
        <box
          height={2}
          paddingLeft={1}
          paddingTop={1}
          backgroundColor={THEME.backgroundElement}
          border={['bottom']}
          borderColor={THEME.borderSubtle}
        >
          <text>
            <span fg={THEME.mutedText}>{currentChannel.topic}</span>
          </text>
        </box>
      )}

      <scrollbox
        ref={scrollBoxRef as React.RefObject<ScrollBoxRenderable>}
        height={messagesHeight}
        focused={focused}
        stickyScroll={!selectedMessage}
        stickyStart="bottom"
        scrollAcceleration={chatScrollAccel}
        style={{
          scrollbarOptions: {
            showArrows: true,
            trackOptions: {
              foregroundColor: THEME.accentBlue,
              backgroundColor: THEME.borderSubtle,
            },
          },
        }}
      >
        {allMessages.map((msg: Message) => {
          const isSelected = selectedMessage?.id === msg.id
          const isSelectable = SELECTABLE_TYPES.includes(msg.type)
          const { username } = formatMessage(msg)
          const offset = contentOffset(username)
          return (
            <box
              key={msg.id}
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={isSelected ? THEME.selectedBackground : undefined}
              onMouseDown={isSelectable ? () => setSelectedMessage(msg) : undefined}
            >
              {msg.replyMessage && <ReplyPreview replyMessage={msg.replyMessage} offset={offset} />}
              {msg.isMultiline && msg.lines ? (
                <MultilineMessageView
                  msg={msg}
                  username={username}
                  timestamp={formatTimestamp(msg.timestamp)}
                  offset={offset}
                  isSelected={isSelected || expandMultilines}
                />
              ) : (
                renderMessage(msg)
              )}
              {isSelected && (
                <box paddingLeft={offset}>
                  <text fg={THEME.mutedText}>
                    <span fg={THEME.accentBlue}>[e]</span> React{' '}
                    <span fg={THEME.accentBlue}>[r]</span> Reply{' '}
                    <span fg={THEME.accentBlue}>[y]</span> Copy
                  </text>
                </box>
              )}
              {msg.reactions.length > 0 && (
                <ReactionsRow reactions={msg.reactions} paddingLeft={offset} />
              )}
            </box>
          )
        })}
      </scrollbox>
    </box>
  )
}
