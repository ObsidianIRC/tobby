import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/store'

describe('quitWarning store', () => {
  beforeEach(() => {
    useStore.setState({ quitWarning: null })
  })

  it('starts as null', () => {
    expect(useStore.getState().quitWarning).toBeNull()
  })

  it('sets a warning message', () => {
    useStore.getState().setQuitWarning('⚠ Press Ctrl+D again to quit')
    expect(useStore.getState().quitWarning).toBe('⚠ Press Ctrl+D again to quit')
  })

  it('clears the warning message', () => {
    useStore.getState().setQuitWarning('⚠ Press Ctrl+D again to quit')
    useStore.getState().setQuitWarning(null)
    expect(useStore.getState().quitWarning).toBeNull()
  })

  it('replaces a warning with another', () => {
    useStore.getState().setQuitWarning('first')
    useStore.getState().setQuitWarning('second')
    expect(useStore.getState().quitWarning).toBe('second')
  })

  it('is independent of selectedMessage', () => {
    useStore.setState({
      selectedMessage: {
        id: 'msg-1',
        channelId: 'ch-1',
        serverId: 'srv-1',
        userId: 'alice',
        content: 'hi',
        timestamp: new Date(),
        type: 'message',
        reactions: [],
        replyMessage: null,
        mentioned: [],
      },
    })
    useStore.getState().setQuitWarning('⚠ warning')
    expect(useStore.getState().selectedMessage?.id).toBe('msg-1')
    expect(useStore.getState().quitWarning).toBe('⚠ warning')
  })
})
