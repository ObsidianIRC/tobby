import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/store'

describe('UI Toggle Actions', () => {
  beforeEach(() => {
    // Reset store to initial state
    useStore.setState({
      showServerPane: true,
      showUserPane: true,
      focusedPane: 'chat',
    })
  })

  it('should toggle server pane visibility', () => {
    const store = useStore.getState()
    const initialState = store.showServerPane

    store.toggleServerPane()
    expect(useStore.getState().showServerPane).toBe(!initialState)

    store.toggleServerPane()
    expect(useStore.getState().showServerPane).toBe(initialState)
  })

  it('should toggle user pane visibility', () => {
    const store = useStore.getState()
    const initialState = store.showUserPane

    store.toggleUserPane()
    expect(useStore.getState().showUserPane).toBe(!initialState)

    store.toggleUserPane()
    expect(useStore.getState().showUserPane).toBe(initialState)
  })

  it('should set focused pane', () => {
    const store = useStore.getState()

    store.setFocusedPane('servers')
    expect(useStore.getState().focusedPane).toBe('servers')

    store.setFocusedPane('chat')
    expect(useStore.getState().focusedPane).toBe('chat')

    store.setFocusedPane('users')
    expect(useStore.getState().focusedPane).toBe('users')
  })

  it('should toggle server pane multiple times correctly', () => {
    const store = useStore.getState()

    expect(useStore.getState().showServerPane).toBe(true)

    store.toggleServerPane()
    expect(useStore.getState().showServerPane).toBe(false)

    store.toggleServerPane()
    expect(useStore.getState().showServerPane).toBe(true)

    store.toggleServerPane()
    expect(useStore.getState().showServerPane).toBe(false)
  })

  it('should toggle user pane multiple times correctly', () => {
    const store = useStore.getState()

    expect(useStore.getState().showUserPane).toBe(true)

    store.toggleUserPane()
    expect(useStore.getState().showUserPane).toBe(false)

    store.toggleUserPane()
    expect(useStore.getState().showUserPane).toBe(true)

    store.toggleUserPane()
    expect(useStore.getState().showUserPane).toBe(false)
  })
})
