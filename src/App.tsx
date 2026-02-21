import { useEffect, useRef } from 'react'
import { useKeyboard, useRenderer } from '@opentui/react'
import type { Selection } from '@opentui/core'
import { MainLayout } from './components/layout/MainLayout'
import { useStore } from './store'
import { AppProvider } from './context/AppContext'
import { createActionRegistry } from './actions/createActionRegistry'
import { autoConnectServers } from './utils/autoConnect'
import { copyToClipboard } from './utils/clipboard'

const registry = createActionRegistry()

export function App() {
  const renderer = useRenderer()
  const toggleUserPane = useStore((state) => state.toggleUserPane)
  const ircClient = useStore((state) => state.ircClient)
  const initializeIRC = useStore((state) => state.initializeIRC)
  const loadPersistedServers = useStore((state) => state.loadPersistedServers)
  const servers = useStore((state) => state.servers)
  const hasAutoConnected = useRef(false)
  const quitConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize IRC and load persisted servers
  useEffect(() => {
    debugLog?.('App mounted, loading persisted servers and initializing IRC')
    loadPersistedServers()
    initializeIRC()
    // --setup: open the connect modal so the user can fill in server details
    if (globalThis.__SETUP_MODE__) {
      setTimeout(() => useStore.getState().openModal('connect'), 50)
    }
  }, [initializeIRC, loadPersistedServers])

  // Auto-connect to servers after they're loaded and IRC is initialized.
  // Skipped in --setup mode — connection happens after the modal is submitted.
  useEffect(() => {
    if (globalThis.__SETUP_MODE__) return
    if (ircClient && servers.length > 0 && !hasAutoConnected.current) {
      hasAutoConnected.current = true
      debugLog?.('Scheduling auto-connect in 1 second...')
      setTimeout(() => {
        autoConnectServers(ircClient)
      }, 1000)
    }
  }, [ircClient, servers])

  // Select-to-copy: copy selected text to clipboard and deselect
  useEffect(() => {
    const handleSelection = (selection: Selection) => {
      const text = selection.getSelectedText()
      if (text) {
        copyToClipboard(text)
        renderer.clearSelection()
      }
    }
    renderer.on('selection', handleSelection)
    return () => {
      renderer.off('selection', handleSelection)
    }
  }, [renderer])

  useKeyboard((key) => {
    debugLog?.(
      `key: name=${JSON.stringify(key.name)} seq=${JSON.stringify(key.sequence)} ctrl=${key.ctrl} meta=${key.meta} shift=${key.shift} option=${key.option}`
    )

    if (key.name === 'd' && key.ctrl) {
      // Blocked while in message selection mode — selection owns the keyboard then
      if (useStore.getState().selectedMessage) return

      if (quitConfirmTimer.current) {
        clearTimeout(quitConfirmTimer.current)
        quitConfirmTimer.current = null
        useStore.getState().setQuitWarning(null)
        renderer.destroy()
        process.exit(0)
        return
      }
      // First press — show orange warning in command input area
      useStore.getState().setQuitWarning(' Press Ctrl+D again within 3 seconds to quit')
      quitConfirmTimer.current = setTimeout(() => {
        quitConfirmTimer.current = null
        useStore.getState().setQuitWarning(null)
      }, 3000)
      return
    }

    if (key.name === 'escape' && key.ctrl) {
      renderer.destroy()
      process.exit(0)
      return
    }

    if (key.ctrl && key.name === 'l') {
      const { currentChannelId, clearMessages } = useStore.getState()
      if (currentChannelId) clearMessages(currentChannelId)
      return
    }

    if (key.ctrl && key.name === 'g') {
      toggleUserPane()
      return
    }

    if (key.ctrl && key.name === 'k') {
      useStore.getState().openModal('quickActions')
      return
    }

    // Alt+N / Alt+P — next/prev buffer
    if ((key.meta || key.option) && key.name === 'n') {
      const context = {
        store: useStore.getState(),
        ircClient: ircClient!,
        currentServer: useStore
          .getState()
          .servers.find((s) => s.id === useStore.getState().currentServerId),
        renderer,
      }
      registry.execute('buffer.next', context)
      return
    }

    if ((key.meta || key.option) && key.name === 'p') {
      const context = {
        store: useStore.getState(),
        ircClient: ircClient!,
        currentServer: useStore
          .getState()
          .servers.find((s) => s.id === useStore.getState().currentServerId),
        renderer,
      }
      registry.execute('buffer.prev', context)
      return
    }

    // Alt+[ / Alt+] — reorder server or channel up/down
    // These non-alphanumeric Alt combos don't get meta:true from the parser;
    // detect them by raw sequence (\x1b[ and \x1b]) instead.
    const isAltBracketOpen =
      key.sequence === '\x1b[' || ((key.meta || key.option) && key.name === '[')
    const isAltBracketClose =
      key.sequence === '\x1b]' || ((key.meta || key.option) && key.name === ']')
    if (isAltBracketOpen || isAltBracketClose) {
      const state = useStore.getState()
      const { currentServerId, currentChannelId } = state
      if (!currentServerId) return
      const direction = isAltBracketOpen ? 'up' : 'down'
      if (currentChannelId) {
        state.reorderChannel(currentServerId, currentChannelId, direction)
      } else {
        state.reorderServer(currentServerId, direction)
      }
      return
    }

    // Alt+1..9,0 — jump to buffer by number
    if ((key.meta || key.option) && /^[0-9]$/.test(key.name)) {
      const context = {
        store: useStore.getState(),
        ircClient: ircClient!,
        currentServer: useStore
          .getState()
          .servers.find((s) => s.id === useStore.getState().currentServerId),
        renderer,
      }
      registry.execute(`buffer.goto.${key.name}`, context)
      return
    }
  })

  return (
    <AppProvider registry={registry} ircClient={ircClient} renderer={renderer}>
      <MainLayout />
    </AppProvider>
  )
}
