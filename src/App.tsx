import { useEffect } from 'react'
import { useKeyboard, useRenderer } from '@opentui/react'
import { MainLayout } from './components/layout/MainLayout'
import { useStore } from './store'
import { AppProvider } from './context/AppContext'
import { createActionRegistry } from './actions/createActionRegistry'

const registry = createActionRegistry()

export function App() {
  const renderer = useRenderer()
  const toggleServerPane = useStore((state) => state.toggleServerPane)
  const toggleUserPane = useStore((state) => state.toggleUserPane)
  const ircClient = useStore((state) => state.ircClient)
  const initializeIRC = useStore((state) => state.initializeIRC)

  useEffect(() => {
    initializeIRC()
  }, [initializeIRC])

  useKeyboard((key) => {
    if (key.name === 'd' && key.ctrl) {
      renderer.destroy()
      return
    }

    if (key.name === 'escape' && key.ctrl) {
      renderer.destroy()
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
