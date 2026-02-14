import { useEffect, useState } from 'react'
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
  const toggleServerPane = useStore((state) => state.toggleServerPane)
  const toggleUserPane = useStore((state) => state.toggleUserPane)
  const ircClient = useStore((state) => state.ircClient)
  const initializeIRC = useStore((state) => state.initializeIRC)
  const loadPersistedServers = useStore((state) => state.loadPersistedServers)
  const servers = useStore((state) => state.servers)
  const [hasAutoConnected, setHasAutoConnected] = useState(false)

  // Initialize IRC and load persisted servers
  useEffect(() => {
    loadPersistedServers()
    initializeIRC()
  }, [initializeIRC, loadPersistedServers])

  // Auto-connect to servers after they're loaded and IRC is initialized
  useEffect(() => {
    if (ircClient && servers.length > 0 && !hasAutoConnected) {
      setHasAutoConnected(true)
      setTimeout(() => {
        autoConnectServers(ircClient)
      }, 1000)
    }
  }, [ircClient, servers, hasAutoConnected])

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

    switch (key.name) {
      case 'h':
        if (key.ctrl) {
          toggleServerPane()
        }
        break
      case 'l':
        if (key.ctrl) {
          toggleUserPane()
        }
        break
      case 'k':
        if (key.ctrl) {
          useStore.getState().openModal('quickActions')
        }
        break
    }
  })

  return (
    <AppProvider registry={registry} ircClient={ircClient} renderer={renderer}>
      <MainLayout />
    </AppProvider>
  )
}
