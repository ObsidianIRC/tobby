import { useStore } from '../../store'
import { THEME } from '../../constants/theme'
import { stripIrcFormatting } from '../../utils/ircFormatting'
import type { Message } from '../../types'

const SELECTABLE_TYPES: Message['type'][] = ['message', 'action']

interface SearchBarProps {
  width: number
}

export function SearchBar({ width }: SearchBarProps) {
  const messageSearch = useStore((s) => s.messageSearch)
  const setMessageSearch = useStore((s) => s.setMessageSearch)
  const setSelectedMessage = useStore((s) => s.setSelectedMessage)
  const currentChannelId = useStore((s) => s.currentChannelId)
  const messages = useStore((s) => s.messages)

  if (!messageSearch) return null

  const handleInput = (query: string) => {
    const channelMsgs = currentChannelId ? (messages.get(currentChannelId) ?? []) : []
    const selectable = channelMsgs.filter((m) => SELECTABLE_TYPES.includes(m.type))

    let matchIds: string[] = []
    if (query.trim()) {
      const lower = query.toLowerCase()
      matchIds = selectable
        .filter((m) =>
          (stripIrcFormatting(m.content).split('\n')[0] ?? '').toLowerCase().includes(lower)
        )
        .map((m) => m.id)
        .reverse()
    }

    const newestMatch =
      matchIds.length > 0 ? (channelMsgs.find((m) => m.id === matchIds[0]) ?? null) : null

    setMessageSearch({ ...messageSearch, query, matchIds, currentIndex: 0 })
    if (newestMatch) setSelectedMessage(newestMatch)
  }

  const { query, matchIds, currentIndex, typing } = messageSearch

  const hasQuery = query.trim().length > 0
  const countColor = matchIds.length > 0 ? THEME.accentCyan : THEME.error

  return (
    <box
      width={width}
      height={1}
      flexDirection="row"
      backgroundColor={THEME.backgroundPanel}
      paddingLeft={1}
      paddingRight={1}
    >
      <box flexDirection="row" flexGrow={1}>
        <text>
          <span fg={THEME.accentCyan}>/ </span>
        </text>
        <input
          focused={typing}
          value={query}
          onInput={handleInput}
          placeholder="search..."
          flexGrow={1}
          backgroundColor={THEME.backgroundPanel}
          focusedBackgroundColor={THEME.backgroundPanel}
        />
      </box>
      {hasQuery && (
        <text>
          <span fg={countColor}>
            {matchIds.length > 0 ? `${currentIndex + 1} / ${matchIds.length}` : 'no matches'}
          </span>
          {!typing && matchIds.length > 0 && <span fg={THEME.dimText}>{'  p↑ n↓ · Esc'}</span>}
        </text>
      )}
    </box>
  )
}
