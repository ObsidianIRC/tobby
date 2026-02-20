import { useStore } from '../../store'
import { THEME } from '../../constants/theme'

interface TypingIndicatorProps {
  width: number
}

export function TypingIndicator({ width }: TypingIndicatorProps) {
  const typingUsers = useStore((state) => state.typingUsers)
  const currentChannelId = useStore((state) => state.currentChannelId)

  const users = currentChannelId ? (typingUsers[currentChannelId] ?? []) : []

  let text = ''
  if (users.length === 1) {
    text = `${users[0]} is typing...`
  } else if (users.length === 2) {
    text = `${users[0]} and ${users[1]} are typing...`
  } else if (users.length > 2) {
    text = `${users[0]}, ${users[1]}, and more are typing...`
  }

  return (
    <box width={width} height={1} paddingLeft={1} backgroundColor={THEME.backgroundInput}>
      {text && (
        <text>
          <span fg={THEME.mutedText}>{text}</span>
        </text>
      )}
    </box>
  )
}
