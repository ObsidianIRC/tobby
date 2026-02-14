import { MacOSScrollAccel } from '@opentui/core'
import { useStore } from '../../store'
import { THEME, COLORS, NICKNAME_COLORS } from '../../constants/theme'
import { SplitBorder } from '../../constants/borders'
import { renderIrcText } from '../../utils/ircFormatting'
import type { Message } from '../../types'

const chatScrollAccel = new MacOSScrollAccel({ maxMultiplier: 8 })

// Hash function for consistent nickname colors
const hashString = (str: string): number => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash)
}

const getNicknameColor = (nickname: string): string => {
  const index = hashString(nickname) % NICKNAME_COLORS.length
  return NICKNAME_COLORS[index]
}

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

  const currentServer = servers.find((s) => s.id === currentServerId)
  const currentChannel = currentServer?.channels.find((c) => c.id === currentChannelId)

  const allMessages = currentChannelId ? (messages.get(currentChannelId) ?? []) : []

  const channelHeaderHeight = currentChannel ? 2 : 0
  const topicHeight = currentChannel?.topic ? 2 : 0
  const messagesHeight = height - channelHeaderHeight - topicHeight - 2

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
            <span fg={THEME.foreground}>{renderIrcText(msg.content, msg.id, currentServer?.nickname)}</span>
          </text>
        )
      case 'action':
        return (
          <text>
            <span fg={THEME.dimText}>[{timestamp}]</span>
            <span fg={COLORS.magenta}> * {username}</span>
            <span fg={COLORS.magenta}> {msg.content}</span>
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
      {...SplitBorder}
      borderColor={focused ? THEME.borderFocus : THEME.border}
      flexDirection="column"
      backgroundColor={THEME.backgroundChat}
    >
      {currentChannel && (
        <box
          height={2}
          paddingLeft={1}
          paddingTop={1}
          backgroundColor={THEME.backgroundHighlight}
          borderBottom
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
      {currentChannel?.topic && (
        <box
          height={2}
          paddingLeft={1}
          paddingTop={1}
          backgroundColor={THEME.backgroundElement}
          borderBottom
          borderColor={THEME.borderSubtle}
        >
          <text>
            <span fg={THEME.mutedText}>{currentChannel.topic}</span>
          </text>
        </box>
      )}

      <scrollbox
        height={messagesHeight}
        focused={focused}
        stickyScroll={true}
        stickyStart="bottom"
        scrollAcceleration={chatScrollAccel}
        style={{
          scrollbarOptions: {
            showArrows: true,
            trackOptions: {
              foregroundColor: THEME.accentBlue,
              backgroundColor: THEME.borderSubtle
            }
          }
        }}
      >
        {allMessages.map((msg: Message) => (
          <box key={msg.id} paddingLeft={1} paddingRight={1}>
            {renderMessage(msg)}
          </box>
        ))}
      </scrollbox>
    </box>
  )
}
