import { MacOSScrollAccel } from '@opentui/core'
import { useStore } from '../../store'
import { THEME, COLORS } from '../../constants/theme'
import { renderIrcText } from '../../utils/ircFormatting'
import { getNicknameColor } from '../../utils/nickColors'
import type { Message } from '../../types'

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
              backgroundColor: THEME.borderSubtle,
            },
          },
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
