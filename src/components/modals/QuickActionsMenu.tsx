import { useState, useMemo } from 'react'
import { useKeyboard } from '@opentui/react'
import Fuse from 'fuse.js'
import { useStore } from '../../store'
import { useAppContext } from '../../context/AppContext'
import { THEME } from '../../constants/theme'
import type { Action } from '../../types'

interface QuickActionsMenuProps {
  width: number
  height: number
}

export function QuickActionsMenu({ width, height }: QuickActionsMenuProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const { registry, ircClient, renderer } = useAppContext()
  const store = useStore()
  const closeModal = useStore((state) => state.closeModal)

  const currentServer = store.servers.find((s) => s.id === store.currentServerId)
  const currentChannel = currentServer?.channels.find((c) => c.id === store.currentChannelId)

  const context = {
    store,
    ircClient: ircClient || ({} as never),
    currentServer,
    currentChannel,
    renderer,
  }

  const allActions = registry.getAll().filter((action) => {
    if (action.isVisible && !action.isVisible(context)) {
      return false
    }
    return true
  })

  const fuse = useMemo(() => {
    return new Fuse(allActions, {
      keys: ['label', 'description', 'keywords', 'id'],
      threshold: 0.3,
      includeScore: true,
    })
  }, [allActions])

  const actions = query ? fuse.search(query).map((result) => result.item) : allActions

  const visibleActions = actions.slice(0, 10)

  useKeyboard((key) => {
    if (key.name === 'escape') {
      closeModal()
      return
    }

    if (key.name === 'tab') {
      if (key.shift) {
        setSelectedIndex((prev) => Math.max(0, prev - 1))
      } else {
        setSelectedIndex((prev) => Math.min(visibleActions.length - 1, prev + 1))
      }
      return
    }

    if (key.name === 'up') {
      setSelectedIndex((prev) => Math.max(0, prev - 1))
      return
    }

    if (key.name === 'down') {
      setSelectedIndex((prev) => Math.min(visibleActions.length - 1, prev + 1))
      return
    }

    if (key.name === 'return') {
      const action = visibleActions[selectedIndex]
      if (action && ircClient) {
        try {
          registry.execute(action.id, { ...context, ircClient })
          closeModal()
        } catch (error) {
          // Error handling
        }
      }
      return
    }

    if (key.name === 'backspace') {
      setQuery((prev) => prev.slice(0, -1))
      setSelectedIndex(0)
      return
    }

    if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
      setQuery((prev) => prev + key.sequence)
      setSelectedIndex(0)
    }
  })

  const modalWidth = Math.min(60, width - 4)
  const modalHeight = Math.min(20, height - 4)
  const modalX = Math.floor((width - modalWidth) / 2)
  const modalY = Math.floor((height - modalHeight) / 2)

  return (
    <box
      position="absolute"
      left={modalX}
      top={modalY}
      width={modalWidth}
      height={modalHeight}
      border
      borderStyle="single"
      borderColor={THEME.borderActive}
      backgroundColor={THEME.backgroundPanel}
      flexDirection="column"
    >
      <box
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        backgroundColor={THEME.backgroundElement}
      >
        <text fg={THEME.foreground}>
          <span fg={THEME.accent}>Search: </span>
          {query}
          <span fg={THEME.accent}>█</span>
        </text>
      </box>

      <scrollbox focused height={modalHeight - 5} marginTop={1}>
        {visibleActions.length === 0 ? (
          <box paddingLeft={2} paddingTop={1}>
            <text fg={THEME.mutedText}>No actions found</text>
          </box>
        ) : (
          visibleActions.map((action: Action<typeof store>, index: number) => (
            <box
              key={action.id}
              paddingLeft={2}
              paddingRight={2}
              paddingTop={1}
              paddingBottom={1}
              backgroundColor={index === selectedIndex ? THEME.selectedBackground : undefined}
            >
              <box flexDirection="row" gap={2}>
                <text fg={index === selectedIndex ? THEME.accent : THEME.foreground}>
                  <strong>{action.label}</strong>
                </text>
                {action.keybinding && <text fg={THEME.mutedText}>[{action.keybinding}]</text>}
              </box>
              {action.description && (
                <box paddingLeft={0} paddingTop={0}>
                  <text fg={THEME.mutedText}>{action.description}</text>
                </box>
              )}
            </box>
          ))
        )}
      </scrollbox>

      <box
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        backgroundColor={THEME.backgroundElement}
        justifyContent="space-between"
        flexDirection="row"
      >
        <text fg={THEME.mutedText}>
          <span fg={THEME.accent}>↑↓</span> or <span fg={THEME.accent}>Tab</span> Navigate
        </text>
        <text fg={THEME.mutedText}>
          <span fg={THEME.accent}>Enter</span> Select • <span fg={THEME.accent}>Esc</span> Close
        </text>
      </box>
    </box>
  )
}
