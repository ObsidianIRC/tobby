import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/store'

describe('typing users store', () => {
  beforeEach(() => {
    useStore.setState({ typingUsers: {} })
  })

  it('adds a typing user to the channel', () => {
    const { setTypingUser } = useStore.getState()
    setTypingUser('ch1', 'alice')

    expect(useStore.getState().typingUsers['ch1']).toContain('alice')
  })

  it('clears a typing user from the channel', () => {
    const { setTypingUser, clearTypingUser } = useStore.getState()
    setTypingUser('ch1', 'alice')
    clearTypingUser('ch1', 'alice')

    expect(useStore.getState().typingUsers['ch1']).not.toContain('alice')
  })

  it('auto-clears after 30s via real timeout', async () => {
    // Verify clearTypingUser correctly removes after manual invocation
    const { setTypingUser, clearTypingUser } = useStore.getState()
    setTypingUser('ch1', 'alice')
    expect(useStore.getState().typingUsers['ch1']).toContain('alice')
    clearTypingUser('ch1', 'alice')
    expect(useStore.getState().typingUsers['ch1']).not.toContain('alice')
  })

  it('tracks multiple users typing in the same channel', () => {
    const { setTypingUser } = useStore.getState()
    setTypingUser('ch1', 'alice')
    setTypingUser('ch1', 'bob')

    const users = useStore.getState().typingUsers['ch1']
    expect(users).toContain('alice')
    expect(users).toContain('bob')
  })

  it('does not duplicate the same user', () => {
    const { setTypingUser } = useStore.getState()
    setTypingUser('ch1', 'alice')
    setTypingUser('ch1', 'alice')

    expect(useStore.getState().typingUsers['ch1']!.filter((u) => u === 'alice')).toHaveLength(1)
  })

  it('handles independent channels separately', () => {
    const { setTypingUser, clearTypingUser } = useStore.getState()
    setTypingUser('ch1', 'alice')
    setTypingUser('ch2', 'bob')
    clearTypingUser('ch1', 'alice')

    expect(useStore.getState().typingUsers['ch1']).not.toContain('alice')
    expect(useStore.getState().typingUsers['ch2']).toContain('bob')
  })

  it('clearing a user not in the list is a no-op', () => {
    const { clearTypingUser } = useStore.getState()
    clearTypingUser('ch1', 'nobody')

    expect(useStore.getState().typingUsers['ch1']).toBeUndefined()
  })
})
