import { useState, useMemo, useRef } from 'react'
import { useKeyboard } from '@opentui/react'
import Fuse from 'fuse.js'
import { useStore } from '../../store'
import { THEME } from '../../constants/theme'
import { ModalShell } from './ModalShell'
import { EMOJI_LIST } from '../../utils/emojiData'
import type { EmojiEntry } from '../../utils/emojiData'

interface EmojiPickerModalProps {
  width: number
  height: number
  onEmojiSelect: (emoji: string) => void
}

export function EmojiPickerModal({ width, height, onEmojiSelect }: EmojiPickerModalProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const programmaticUpdate = useRef(false)
  const closeModal = useStore((state) => state.closeModal)

  const modalWidth = Math.min(50, width - 4)
  const modalHeight = Math.min(18, height - 4)

  const fuse = useMemo(
    () => new Fuse(EMOJI_LIST, { keys: ['name', 'keywords'], threshold: 0.3 }),
    []
  )

  const items: EmojiEntry[] = useMemo(() => {
    if (!query) return EMOJI_LIST.slice(0, 50)
    return fuse.search(query, { limit: 50 }).map((r) => r.item)
  }, [query, fuse])

  const visibleItems = items.slice(0, modalHeight - 4)

  const handleSelect = (entry: EmojiEntry) => {
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
        <span fg={THEME.accent}>↑↓</span> Navigate <span fg={THEME.accent}>Enter</span> Select
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
      title="Pick Emoji"
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
          visibleItems.map((entry, index) => (
            <box
              key={entry.char}
              paddingLeft={2}
              paddingRight={2}
              backgroundColor={index === selectedIndex ? THEME.selectedBackground : undefined}
            >
              <text fg={index === selectedIndex ? THEME.accent : THEME.foreground}>
                {entry.char} {entry.name.replace(/_/g, ' ')}
              </text>
            </box>
          ))
        )}
      </scrollbox>
    </ModalShell>
  )
}
