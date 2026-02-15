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

  // Initialize IRC and load persisted servers
  useEffect(() => {
    debugLog?.('App mounted, loading persisted servers and initializing IRC')
    loadPersistedServers()
    initializeIRC()
  }, [initializeIRC, loadPersistedServers])

  // Auto-connect to servers after they're loaded and IRC is initialized
  useEffect(() => {
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
    if (key.name === 'd' && key.ctrl) {
      renderer.destroy()
      process.exit(0)
      return
    }

    if (key.name === 'escape' && key.ctrl) {
      renderer.destroy()
      process.exit(0)
      return
    }

    if (key.ctrl && key.name === 'l') {
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
