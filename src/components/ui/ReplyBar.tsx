import { useKeyboard } from '@opentui/react'
import { useStore } from '../../store'
import { THEME } from '../../constants/theme'
import { stripIrcFormatting } from '../../utils/ircFormatting'

interface ReplyBarProps {
  width: number
}

export function ReplyBar({ width }: ReplyBarProps) {
  const replyingTo = useStore((state) => state.replyingTo)
  const setReplyingTo = useStore((state) => state.setReplyingTo)

  useKeyboard((key) => {
    if (key.name === 'escape' && replyingTo) {
      setReplyingTo(null)
    }
  })

  if (!replyingTo) return null

  const content = stripIrcFormatting(replyingTo.content)
  const truncated = content.length > 60 ? content.slice(0, 60) + '...' : content

  return (
    <box width={width} height={2} flexDirection="column" backgroundColor={THEME.selectedBackground}>
      <box height={1} paddingLeft={2}>
        <text fg={THEME.mutedText}>
          <span fg={THEME.accentBlue}>↩</span> <span fg={THEME.mutedText}>Replying to </span>
          <span fg={THEME.accentPink}>{replyingTo.userId}</span>
          <span fg={THEME.mutedText}> › </span>
          <span fg={THEME.foreground}>{truncated}</span>
          <span fg={THEME.dimText}> Esc to cancel</span>
        </text>
      </box>
      <box height={1} />
    </box>
  )
}
