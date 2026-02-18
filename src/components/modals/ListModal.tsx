import { useKeyboard } from '@opentui/react'
import { useState, useMemo } from 'react'
import Fuse from 'fuse.js'
import { ModalShell } from './ModalShell'
import { THEME } from '../../constants/theme'

export interface ListItem {
  id: string
  label: string
  sublabel?: string
  icon?: string
  fg?: string
}

interface ListModalProps {
  width: number
  height: number
  title?: string
  items: ListItem[]
  query: string
  onQueryChange: (q: string) => void
  onSelect: (item: ListItem) => void
  onCancel: () => void
  placeholder?: string
  emptyMessage?: string
}

export function ListModal({
  width,
  height,
  title,
  items,
  query,
  onQueryChange,
  onSelect,
  onCancel,
  placeholder = 'Search...',
  emptyMessage = 'No results',
}: ListModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const modalWidth = Math.min(60, width - 4)
  const modalHeight = Math.min(20, height - 4)

  const fuse = useMemo(
    () => new Fuse(items, { keys: ['label', 'sublabel'], threshold: 0.4 }),
    [items]
  )

  const filteredItems = useMemo(() => {
    if (!query) return items
    return fuse.search(query).map((r) => r.item)
  }, [query, items, fuse])

  const visibleItems = filteredItems.slice(0, modalHeight - 5)

  useKeyboard((key) => {
    if (key.name === 'escape') {
      onCancel()
      return
    }

    if (key.name === 'tab') {
      if (key.shift) {
        setSelectedIndex((prev) => Math.max(0, prev - 1))
      } else {
        setSelectedIndex((prev) => Math.min(visibleItems.length - 1, prev + 1))
      }
      return
    }

    if (key.name === 'up') {
      setSelectedIndex((prev) => Math.max(0, prev - 1))
      return
    }

    if (key.name === 'down') {
      setSelectedIndex((prev) => Math.min(visibleItems.length - 1, prev + 1))
      return
    }

    if (key.name === 'return') {
      const item = visibleItems[selectedIndex]
      if (item) {
        onSelect(item)
      }
      return
    }

    if (key.name === 'backspace') {
      onQueryChange(query.slice(0, -1))
      setSelectedIndex(0)
      return
    }

    if (key.name === 'delete') {
      onQueryChange('')
      setSelectedIndex(0)
      return
    }

    if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
      onQueryChange(query + key.sequence)
      setSelectedIndex(0)
    }
  })

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
      title={title}
      footer={footer}
    >
      <box
        paddingLeft={2}
        paddingRight={2}
        height={2}
        paddingTop={1}
        backgroundColor={THEME.backgroundElement}
      >
        <text fg={THEME.foreground}>
          <span fg={THEME.accent}>{query ? '' : placeholder}</span>
          {query}
          <span fg={THEME.accent}>█</span>
        </text>
      </box>

      <scrollbox focused height={modalHeight - 5}>
        {visibleItems.length === 0 ? (
          <box paddingLeft={2} paddingTop={1}>
            <text fg={THEME.mutedText}>{emptyMessage}</text>
          </box>
        ) : (
          visibleItems.map((item, index) => (
            <box
              key={item.id}
              paddingLeft={2}
              paddingRight={2}
              backgroundColor={index === selectedIndex ? THEME.selectedBackground : undefined}
            >
              <box flexDirection="row" gap={1}>
                {item.icon && <text fg={THEME.mutedText}>{item.icon}</text>}
                <text fg={item.fg ?? (index === selectedIndex ? THEME.accent : THEME.foreground)}>
                  {item.label}
                </text>
                {item.sublabel && <text fg={THEME.mutedText}>{item.sublabel}</text>}
              </box>
            </box>
          ))
        )}
      </scrollbox>
    </ModalShell>
  )
}
