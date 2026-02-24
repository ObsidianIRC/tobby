import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/store'

describe('typing indicators', () => {
  beforeEach(() => {
    useStore.setState({ typingUsers: {} })
  })

  it('setTypingUser adds a nick to the typing list', () => {
    useStore.getState().setTypingUser('ch-1', 'alice')
    expect(useStore.getState().typingUsers['ch-1']).toEqual(['alice'])
  })

  it('clearTypingUser removes a nick from the typing list', () => {
    useStore.getState().setTypingUser('ch-1', 'alice')
    useStore.getState().clearTypingUser('ch-1', 'alice')
    expect(useStore.getState().typingUsers['ch-1']).toEqual([])
  })

  it('clearTypingUser is a no-op for a nick not in the list', () => {
    useStore.getState().setTypingUser('ch-1', 'alice')
    useStore.getState().clearTypingUser('ch-1', 'bob')
    expect(useStore.getState().typingUsers['ch-1']).toEqual(['alice'])
  })

  it('does not add the same nick twice', () => {
    useStore.getState().setTypingUser('ch-1', 'alice')
    useStore.getState().setTypingUser('ch-1', 'alice')
    expect(useStore.getState().typingUsers['ch-1']).toEqual(['alice'])
  })

  it('tracks multiple users typing in the same channel', () => {
    useStore.getState().setTypingUser('ch-1', 'alice')
    useStore.getState().setTypingUser('ch-1', 'bob')
    expect(useStore.getState().typingUsers['ch-1']).toEqual(['alice', 'bob'])
  })

  it('clears only the specified user when multiple are typing', () => {
    useStore.getState().setTypingUser('ch-1', 'alice')
    useStore.getState().setTypingUser('ch-1', 'bob')
    useStore.getState().clearTypingUser('ch-1', 'alice')
    expect(useStore.getState().typingUsers['ch-1']).toEqual(['bob'])
  })
})

describe('NAMES merge behavior', () => {
  beforeEach(() => {
    useStore.setState({
      servers: [
        {
          id: 'srv-1',
          name: 'test',
          host: 'irc.test',
          port: 6667,
          nickname: 'me',
          channels: [
            {
              id: 'ch-1',
              name: '#test',
              serverId: 'srv-1',
              users: [
                { id: 'u1', username: 'alice', isOnline: true },
                { id: 'u2', username: 'bob', isOnline: true },
              ],
              messages: [],
              unreadCount: 0,
              isPrivate: false,
              isMentioned: false,
            },
          ],
          privateChats: [],
          isConnected: true,
          connectionState: 'connected' as const,
          capabilities: [],
        },
      ],
    })
  })

  it('updateChannel merges users without duplicates', () => {
    const { updateChannel, servers } = useStore.getState()
    const channel = servers[0]!.channels[0]!

    // Simulate NAMES merge logic: add new users, skip existing
    const incomingUsers = [
      { id: 'u1', username: 'alice', isOnline: true },
      { id: 'u3', username: 'charlie', isOnline: true },
    ]
    const existingUsernames = new Set(channel.users.map((u) => u.username))
    const toAdd = incomingUsers.filter((u) => !existingUsernames.has(u.username))

    updateChannel('srv-1', 'ch-1', {
      users: [...channel.users, ...toAdd],
    })

    const updated = useStore.getState().servers[0]!.channels[0]!
    expect(updated.users.map((u) => u.username)).toEqual(['alice', 'bob', 'charlie'])
  })
})
