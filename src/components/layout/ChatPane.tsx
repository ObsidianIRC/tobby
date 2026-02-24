import { useRef, useEffect } from 'react'
import type React from 'react'
import { MacOSScrollAccel } from '@opentui/core'
import type { ScrollBoxRenderable } from '@opentui/core'
import { useStore } from '../../store'
import { THEME, COLORS } from '../../constants/theme'
import { renderIrcText, stripIrcFormatting } from '../../utils/ircFormatting'
import { getNicknameColor } from '../../utils/nickColors'
import { copyToClipboard } from '../../utils/clipboard'
import { focusInput } from '../../utils/inputFocus'
import type { Message } from '../../types'
import { SearchBar } from '../ui/SearchBar'
import {
  msgLineCount as baseMsgLineCount,
  visibleLines as getVisibleLines,
  hiddenCount as getHiddenCount,
} from '../../utils/msgLineCount'
import { computeScrollAdjustment } from '../../utils/scrollAdjustment'

const SELECTABLE_TYPES: Message['type'][] = ['message', 'action']

// [HH:MM] = 7 chars, space = 1, nick = variable, ' › ' = 3
const contentOffset = (nick: string) => 11 + nick.length

// Split text into lines at word boundaries, never exceeding maxWidth per line.
function wordWrap(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0 || text.length <= maxWidth) return [text]
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (!current) {
      current = word
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += ' ' + word
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : [text]
}

// Renders plain text with the first occurrence of `query` highlighted in gold.
function InlineHighlight({ text, query, baseFg }: { text: string; query: string; baseFg: string }) {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return <span fg={baseFg}>{text}</span>
  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + query.length)
  const after = text.slice(idx + query.length)
  return (
    <>
      {before && <span fg={baseFg}>{before}</span>}
      <span fg={COLORS.gold}>{match}</span>
      {after && <span fg={baseFg}>{after}</span>}
    </>
  )
}

function MultilineMessageView({
  msg,
  username,
  timestamp,
  offset,
  isSelected,
  highlightQuery,
}: {
  msg: Message
  username: string
  timestamp: string
  offset: number
  isSelected: boolean
  highlightQuery?: string
}) {
  const nicknameColor = getNicknameColor(username)
  const vLines = getVisibleLines(msg, isSelected)
  const hCount = getHiddenCount(msg)
  const firstLine = vLines[0] ?? ''

  return (
    <box flexDirection="column">
      <text>
        <span fg={THEME.dimText}>[{timestamp}]</span>
        <span fg={nicknameColor}> {username}</span>
        <span fg={THEME.mutedText}> › </span>
        {highlightQuery ? (
          <InlineHighlight text={firstLine} query={highlightQuery} baseFg={THEME.foreground} />
        ) : (
          <span fg={THEME.foreground}>{firstLine}</span>
        )}
      </text>
      {vLines.slice(1).map((line, i) => (
        <text key={i}>
          <span fg={THEME.foreground}>
            {' '.repeat(offset)}
            {line}
          </span>
        </text>
      ))}
      {!isSelected && hCount > 0 && (
        <box paddingLeft={offset}>
          <text fg={THEME.dimText}>
            ▾ {hCount} more line{hCount !== 1 ? 's' : ''}
          </text>
        </box>
      )}
    </box>
  )
}

function ReplyPreview({ replyMessage, offset }: { replyMessage: Message; offset: number }) {
  const raw = stripIrcFormatting(replyMessage.content).split('\n')[0] ?? ''
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
  const setReplyingTo = useStore((state) => state.setReplyingTo)
  const openModal = useStore((state) => state.openModal)
  const expandMultilines = useStore((state) => state.expandMultilines)
  const messageSearch = useStore((state) => state.messageSearch)

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
  const searchBarHeight = messageSearch !== null ? 1 : 0
  const messagesHeight = height - channelHeaderHeight - topicHeight - searchBarHeight

  // Keep refs current so the effect doesn't need them in its dep array
  const allMessagesRef = useRef(allMessages)
  const messagesHeightRef = useRef(messagesHeight)
  const prevSelectedIdxRef = useRef<number>(-1)
  useEffect(() => {
    allMessagesRef.current = allMessages
  }, [allMessages])
  useEffect(() => {
    messagesHeightRef.current = messagesHeight
  }, [messagesHeight])

  // Available content width after prefix and padding (1 scrollbar + 2 box padding)
  const contentWidth = (nick: string) => Math.max(10, width - 3 - contentOffset(nick))

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

  // Compute rendered line-height of a single message box
  const msgLineCount = (msg: Message, isSelected: boolean) => {
    let h = baseMsgLineCount(msg, isSelected, expandMultilines)
    // Account for word-wrapped single-line messages (not part of the base utility)
    if (!msg.isMultiline && (msg.type === 'message' || msg.type === 'action')) {
      const { username } = formatMessage(msg)
      const wrapped = wordWrap(stripIrcFormatting(msg.content), contentWidth(username))
      if (wrapped.length > 1) h += wrapped.length - 1
    }
    return h
  }

  useEffect(() => {
    const box = scrollBoxRef.current
    if (!box) return

    if (!selectedMessage) {
      // Exiting selection — snap back to live view (bottom)
      prevSelectedIdxRef.current = -1
      box.scrollTop = Number.MAX_SAFE_INTEGER
      return
    }

    // Determine navigation direction before the async timers fire
    const msgs = allMessagesRef.current
    const newIdx = msgs.findIndex((m) => m.id === selectedMessage.id)
    const prevIdx = prevSelectedIdxRef.current
    prevSelectedIdxRef.current = newIdx

    const isEntering = prevIdx === -1
    const goingDown = !isEntering && newIdx > prevIdx

    // Defer until after opentui re-renders so the hint row is part of the layout
    const applyScroll = () => {
      const b = scrollBoxRef.current
      if (!b) return

      const currentMsgs = allMessagesRef.current
      const viewportH = messagesHeightRef.current
      const current = b.scrollTop

      const newScrollTop = computeScrollAdjustment(
        currentMsgs,
        selectedMessage,
        viewportH,
        current,
        { isEntering, goingDown },
        msgLineCount
      )
      if (newScrollTop !== null) b.scrollTop = newScrollTop
    }

    const timer = setTimeout(applyScroll, 0)

    return () => {
      clearTimeout(timer)
    }
  }, [selectedMessage, messagesHeight])

  // Collect all member nicks for inline coloring — stable reference via useMemo would be ideal
  // but for a terminal app the re-render cost is negligible
  const channelUsernames = currentChannel?.users.map((u) => u.username) ?? []

  const renderMessage = (msg: Message, highlightQuery?: string) => {
    const { timestamp, username } = formatMessage(msg)
    const nicknameColor = getNicknameColor(username)

    switch (msg.type) {
      case 'message': {
        const offset = contentOffset(username)
        const plainContent = stripIrcFormatting(msg.content)
        const lines = wordWrap(plainContent, contentWidth(username))
        if (lines.length > 1) {
          const firstLine = lines[0] ?? ''
          return (
            <box flexDirection="column">
              <text>
                <span fg={THEME.dimText}>[{timestamp}]</span>
                <span fg={nicknameColor}> {username}</span>
                <span fg={THEME.mutedText}> › </span>
                {highlightQuery ? (
                  <InlineHighlight
                    text={firstLine}
                    query={highlightQuery}
                    baseFg={THEME.foreground}
                  />
                ) : (
                  <span fg={THEME.foreground}>{firstLine}</span>
                )}
              </text>
              {lines.slice(1).map((line, i) => (
                <text key={i}>
                  <span fg={THEME.foreground}>
                    {' '.repeat(offset)}
                    {line}
                  </span>
                </text>
              ))}
            </box>
          )
        }
        return (
          <text>
            <span fg={THEME.dimText}>[{timestamp}]</span>
            <span fg={nicknameColor}> {username}</span>
            <span fg={THEME.mutedText}> › </span>
            {highlightQuery ? (
              <InlineHighlight
                text={plainContent}
                query={highlightQuery}
                baseFg={THEME.foreground}
              />
            ) : (
              <span fg={THEME.foreground}>
                {renderIrcText(msg.content, msg.id, currentServer?.nickname, channelUsernames)}
              </span>
            )}
          </text>
        )
      }
      case 'action': {
        const offset = contentOffset(username)
        const plainContent = stripIrcFormatting(msg.content)
        const lines = wordWrap(plainContent, contentWidth(username))
        if (lines.length > 1) {
          const firstLine = lines[0] ?? ''
          return (
            <box flexDirection="column">
              <text>
                <span fg={THEME.dimText}>[{timestamp}]</span>
                <span fg={COLORS.magenta}> * {username} </span>
                {highlightQuery ? (
                  <InlineHighlight
                    text={firstLine}
                    query={highlightQuery}
                    baseFg={COLORS.magenta}
                  />
                ) : (
                  <span fg={COLORS.magenta}>{firstLine}</span>
                )}
              </text>
              {lines.slice(1).map((line, i) => (
                <text key={i}>
                  <span fg={COLORS.magenta}>
                    {' '.repeat(offset)}
                    {line}
                  </span>
                </text>
              ))}
            </box>
          )
        }
        return (
          <text>
            <span fg={THEME.dimText}>[{timestamp}]</span>
            <span fg={COLORS.magenta}> * {username} </span>
            {highlightQuery ? (
              <InlineHighlight text={plainContent} query={highlightQuery} baseFg={COLORS.magenta} />
            ) : (
              <span fg={COLORS.magenta}>
                {renderIrcText(msg.content, msg.id, currentServer?.nickname, channelUsernames)}
              </span>
            )}
          </text>
        )
      }
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

      {messageSearch !== null && <SearchBar width={width} />}

      <scrollbox
        ref={scrollBoxRef as React.RefObject<ScrollBoxRenderable>}
        height={messagesHeight}
        focused={focused}
        stickyScroll={!selectedMessage}
        stickyStart="bottom"
        scrollAcceleration={chatScrollAccel}
        style={{
          scrollbarOptions: {
            showArrows: false,
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
          const isSearchMatch = messageSearch?.matchIds.includes(msg.id) ?? false
          const isCurrentMatch =
            messageSearch !== null && messageSearch.matchIds[messageSearch.currentIndex] === msg.id
          return (
            <box
              key={msg.id}
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={
                isCurrentMatch
                  ? '#4d3800'
                  : isSelected
                    ? THEME.selectedBackground
                    : isSearchMatch
                      ? '#2a2000'
                      : undefined
              }
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
                  highlightQuery={isSearchMatch ? (messageSearch?.query ?? undefined) : undefined}
                />
              ) : (
                renderMessage(msg, isSearchMatch ? (messageSearch?.query ?? undefined) : undefined)
              )}
              {isSelected && (
                <box paddingLeft={offset} flexDirection="row">
                  <box onMouseDown={() => openModal('emojiPicker')}>
                    <text>
                      <span fg={THEME.accentBlue}>[e]</span>
                      <span fg={THEME.mutedText}> React </span>
                    </text>
                  </box>
                  <box
                    onMouseDown={() => {
                      setReplyingTo(msg)
                      setSelectedMessage(null)
                      focusInput()
                    }}
                  >
                    <text>
                      <span fg={THEME.accentBlue}>[r]</span>
                      <span fg={THEME.mutedText}> Reply </span>
                    </text>
                  </box>
                  <box
                    onMouseDown={() => {
                      copyToClipboard(stripIrcFormatting(msg.content))
                      setSelectedMessage(null)
                    }}
                  >
                    <text>
                      <span fg={THEME.accentBlue}>[y]</span>
                      <span fg={THEME.mutedText}> Copy</span>
                    </text>
                  </box>
                  {/* Always rendered to avoid opentui flex hit-box issues with conditional children */}
                  <box
                    paddingLeft={msg.replyMessage ? 2 : 0}
                    onMouseDown={
                      msg.replyMessage
                        ? () => {
                            const channelMsgs = currentChannelId
                              ? (messages.get(currentChannelId) ?? [])
                              : []
                            const target =
                              channelMsgs.find((m) => m.id === msg.replyMessage!.id) ??
                              channelMsgs.find(
                                (m) => m.msgid && m.msgid === msg.replyMessage!.msgid
                              )
                            if (target) setSelectedMessage(target)
                          }
                        : undefined
                    }
                  >
                    {msg.replyMessage && (
                      <text>
                        <span fg={THEME.accentBlue}>[↵]</span>
                        <span fg={THEME.mutedText}> Jump</span>
                      </text>
                    )}
                  </box>
                </box>
              )}
              {msg.reactions.length > 0 && (
                <ReactionsRow reactions={msg.reactions} paddingLeft={offset} />
              )}
            </box>
          )
        })}
        {/* Spacer so the last message's hint row always has room to scroll into view */}
        <box height={1} />
      </scrollbox>
    </box>
  )
}
