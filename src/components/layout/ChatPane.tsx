import { useStore } from '../../store'
import { THEME, COLORS } from '../../constants/theme'
import { SplitBorder } from '../../constants/borders'
import type { Message } from '../../types'

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

  const topicHeight = currentChannel?.topic ? 2 : 0
  const messagesHeight = height - topicHeight - 2

  // Show only the last messages that fit the viewport (auto-scroll to bottom)
  const visibleMessages = allMessages.slice(-Math.max(messagesHeight, 0))

  const formatTimestamp = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const formatMessage = (msg: Message) => {
    const timestamp = formatTimestamp(msg.timestamp)
    // msg.userId stores the sender's nickname directly
    const user = currentChannel?.users.find(
      (u) => u.username === msg.userId || u.nickname === msg.userId
    )
    const username = user?.nickname || user?.username || msg.userId

    switch (msg.type) {
      case 'message':
        return `[${timestamp}] <${username}> ${msg.content}`
      case 'action':
        return `[${timestamp}] * ${username} ${msg.content}`
      case 'notice':
        return `[${timestamp}] -${username}- ${msg.content}`
      case 'join':
        return `[${timestamp}] → ${username} joined`
      case 'part':
        return `[${timestamp}] ← ${username} left${msg.content ? ` (${msg.content})` : ''}`
      case 'quit':
        return `[${timestamp}] ← ${username} quit${msg.content ? ` (${msg.content})` : ''}`
      case 'kick':
        return `[${timestamp}] ⚠ ${username} was kicked${msg.content ? `: ${msg.content}` : ''}`
      case 'nick':
        return `[${timestamp}] ${username} is now known as ${msg.content}`
      case 'mode':
        return `[${timestamp}] Mode: ${msg.content}`
      case 'system':
        return `[${timestamp}] ${msg.content}`
      default:
        return `[${timestamp}] ${msg.content}`
    }
  }

  const getMessageColor = (msg: Message) => {
    switch (msg.type) {
      case 'join':
        return COLORS.green
      case 'part':
      case 'quit':
        return COLORS.red
      case 'kick':
        return COLORS.red
      case 'nick':
      case 'mode':
        return COLORS.yellow
      case 'system':
        return THEME.mutedText
      case 'notice':
        return COLORS.orange
      default:
        return THEME.foreground
    }
  }

  return (
    <box
      width={width}
      height={height}
      {...SplitBorder}
      borderColor={focused ? THEME.borderActive : THEME.border}
      flexDirection="column"
      backgroundColor={THEME.background}
    >
      {currentChannel?.topic && (
        <box
          height={topicHeight}
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={THEME.backgroundPanel}
        >
          <text fg={THEME.accent}>{currentChannel.topic}</text>
        </box>
      )}

      <box height={messagesHeight} flexDirection="column" justifyContent="flex-end">
        {visibleMessages.map((msg: Message) => (
          <box key={msg.id} paddingLeft={1} paddingRight={1}>
            <text fg={getMessageColor(msg)}>{formatMessage(msg)}</text>
          </box>
        ))}
      </box>
    </box>
  )
}
