import { useState, useMemo, useRef } from 'react'
import { useKeyboard } from '@opentui/react'
import Fuse from 'fuse.js'
import { useStore } from '../../store'
import { THEME, COLORS } from '../../constants/theme'
import { ModalShell } from './ModalShell'
import { EMOJI_LIST } from '../../utils/emojiData'
import type { EmojiEntry } from '../../utils/emojiData'

interface EmojiPickerModalProps {
  width: number
  height: number
  onEmojiSelect: (emoji: string) => void
}

interface DisplayItem extends EmojiEntry {
  status: 'mine' | 'others' | null
  reactionCount: number
}

export function EmojiPickerModal({ width, height, onEmojiSelect }: EmojiPickerModalProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const programmaticUpdate = useRef(false)
  const closeModal = useStore((state) => state.closeModal)
  const selectedMessage = useStore((state) => state.selectedMessage)
  const currentServerId = useStore((state) => state.currentServerId)
  const servers = useStore((state) => state.servers)

  const myNick = servers.find((s) => s.id === currentServerId)?.nickname ?? ''

  const modalWidth = Math.min(56, width - 4)
  const modalHeight = Math.min(18, height - 4)

  // Build unified display list: reaction items first (mine before others), then the rest
  const displayItems: DisplayItem[] = useMemo(() => {
    const reactions = selectedMessage?.reactions ?? []

    const emojiMap = new Map<string, { count: number; mine: boolean }>()
    for (const r of reactions) {
      const entry = emojiMap.get(r.emoji) ?? { count: 0, mine: false }
      entry.count++
      if (r.userId === myNick) entry.mine = true
      emojiMap.set(r.emoji, entry)
    }

    // Mine first, then others
    const reactionChars = Array.from(emojiMap.keys()).sort((a, b) => {
      const am = emojiMap.get(a)!.mine
      const bm = emojiMap.get(b)!.mine
      return am && !bm ? -1 : !am && bm ? 1 : 0
    })

    const reactionCharSet = new Set(reactionChars)

    const reactionItems: DisplayItem[] = reactionChars.map((char) => {
      const base = EMOJI_LIST.find((e) => e.char === char) ?? { char, name: char, keywords: [] }
      const info = emojiMap.get(char)!
      return { ...base, status: info.mine ? 'mine' : 'others', reactionCount: info.count }
    })

    const restItems: DisplayItem[] = EMOJI_LIST.filter((e) => !reactionCharSet.has(e.char)).map(
      (e) => ({ ...e, status: null, reactionCount: 0 })
    )

    return [...reactionItems, ...restItems]
  }, [selectedMessage, myNick])

  const fuse = useMemo(
    () => new Fuse(displayItems, { keys: ['name', 'keywords'], threshold: 0.3 }),
    [displayItems]
  )

  const items: DisplayItem[] = useMemo(() => {
    if (!query) return displayItems.slice(0, 50)
    const results = fuse.search(query, { limit: 50 }).map((r) => r.item)
    // Reaction items that match the query stay at the top
    const reactionResults = results.filter((r) => r.status !== null)
    const restResults = results.filter((r) => r.status === null)
    return [...reactionResults, ...restResults]
  }, [query, fuse, displayItems])

  const visibleItems = items.slice(0, modalHeight - 4)

  const handleSelect = (entry: DisplayItem) => {
    onEmojiSelect(entry.char)
    closeModal()
  }

  useKeyboard((key) => {
    if (key.name === 'escape') {
      closeModal()
      return
    }
    if (key.name === 'up') {
      key.preventDefault()
      setSelectedIndex((prev) => Math.max(0, prev - 1))
      return
    }
    if (key.name === 'down' || key.name === 'tab') {
      key.preventDefault()
      setSelectedIndex((prev) => Math.min(visibleItems.length - 1, prev + 1))
      return
    }
  })

  const handleQueryInput = (value: string) => {
    if (programmaticUpdate.current) {
      programmaticUpdate.current = false
      return
    }
    setQuery(value)
    setSelectedIndex(0)
  }

  const handleQuerySubmit = () => {
    const entry = visibleItems[selectedIndex]
    if (entry) handleSelect(entry)
  }

  const footer = (
    <box
      paddingLeft={2}
      paddingRight={2}
      height={1}
      backgroundColor={THEME.backgroundElement}
      justifyContent="space-between"
      flexDirection="row"
    >
      <text fg={THEME.mutedText}>
        <span fg={THEME.accent}>↑↓</span> Navigate <span fg={THEME.accent}>Enter</span> Toggle
      </text>
      <text fg={THEME.mutedText}>
        <span fg={THEME.accent}>Esc</span> Close
      </text>
    </box>
  )

  return (
    <ModalShell
      width={width}
      height={height}
      modalWidth={modalWidth}
      modalHeight={modalHeight}
      title="React to Message"
      footer={footer}
    >
      <box paddingLeft={2} paddingRight={2} height={1} backgroundColor={THEME.backgroundElement}>
        <input
          focused
          value={query}
          onInput={handleQueryInput}
          onSubmit={handleQuerySubmit}
          placeholder="Search emoji..."
          flexGrow={1}
          backgroundColor={THEME.backgroundElement}
          focusedBackgroundColor={THEME.backgroundElement}
        />
      </box>

      <scrollbox height={modalHeight - 4}>
        {visibleItems.length === 0 ? (
          <box paddingLeft={2} paddingTop={1}>
            <text fg={THEME.mutedText}>No results</text>
          </box>
        ) : (
          visibleItems.map((entry, index) => {
            const isSelected = index === selectedIndex
            const selBg = isSelected ? THEME.selectedBackground : undefined

            if (entry.status === 'mine') {
              return (
                <box
                  key={entry.char}
                  paddingLeft={2}
                  paddingRight={2}
                  backgroundColor={selBg ?? '#2a1515'}
                  flexDirection="row"
                  justifyContent="space-between"
                >
                  <text fg={isSelected ? THEME.accent : THEME.foreground}>
                    {entry.char} {entry.name.replace(/_/g, ' ')}
                  </text>
                  <text>
                    <span fg={THEME.error}>✕ {entry.reactionCount}</span>
                  </text>
                </box>
              )
            }

            if (entry.status === 'others') {
              return (
                <box
                  key={entry.char}
                  paddingLeft={2}
                  paddingRight={2}
                  backgroundColor={selBg ?? '#152215'}
                  flexDirection="row"
                  justifyContent="space-between"
                >
                  <text fg={isSelected ? THEME.accent : THEME.foreground}>
                    {entry.char} {entry.name.replace(/_/g, ' ')}
                  </text>
                  <text>
                    <span fg={COLORS.green}>+ {entry.reactionCount}</span>
                  </text>
                </box>
              )
            }

            return (
              <box key={entry.char} paddingLeft={2} paddingRight={2} backgroundColor={selBg}>
                <text fg={isSelected ? THEME.accent : THEME.foreground}>
                  {entry.char} {entry.name.replace(/_/g, ' ')}
                </text>
              </box>
            )
          })
        )}
      </scrollbox>
    </ModalShell>
  )
}
