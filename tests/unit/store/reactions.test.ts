import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/store'
import type { Message } from '@/types'

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'msg-1',
  msgid: 'abc123',
  channelId: 'ch-1',
  serverId: 'srv-1',
  userId: 'alice',
  content: 'hello',
  timestamp: new Date(),
  type: 'message',
  reactions: [],
  replyMessage: null,
  mentioned: [],
  ...overrides,
})

describe('message reactions via updateMessage', () => {
  beforeEach(() => {
    useStore.setState({
      messages: new Map([['ch-1', [makeMessage()]]]),
    })
  })

  it('adds a reaction', () => {
    const { updateMessage } = useStore.getState()
    updateMessage('ch-1', 'msg-1', { reactions: [{ emoji: '👍', userId: 'alice' }] })

    const msg = useStore
      .getState()
      .messages.get('ch-1')!
      .find((m) => m.id === 'msg-1')!
    expect(msg.reactions).toEqual([{ emoji: '👍', userId: 'alice' }])
  })

  it('accumulates multiple reactions from different users', () => {
    const { updateMessage } = useStore.getState()
    updateMessage('ch-1', 'msg-1', {
      reactions: [
        { emoji: '👍', userId: 'alice' },
        { emoji: '👍', userId: 'bob' },
      ],
    })

    const msg = useStore
      .getState()
      .messages.get('ch-1')!
      .find((m) => m.id === 'msg-1')!
    expect(msg.reactions).toHaveLength(2)
  })

  it('removes a reaction (unreact)', () => {
    useStore.setState({
      messages: new Map([
        [
          'ch-1',
          [
            makeMessage({
              reactions: [
                { emoji: '👍', userId: 'alice' },
                { emoji: '❤️', userId: 'bob' },
              ],
            }),
          ],
        ],
      ]),
    })

    const { updateMessage } = useStore.getState()
    updateMessage('ch-1', 'msg-1', { reactions: [{ emoji: '❤️', userId: 'bob' }] })

    const msg = useStore
      .getState()
      .messages.get('ch-1')!
      .find((m) => m.id === 'msg-1')!
    expect(msg.reactions).toEqual([{ emoji: '❤️', userId: 'bob' }])
  })

  it('does not affect other messages in the channel', () => {
    useStore.setState({
      messages: new Map([
        ['ch-1', [makeMessage({ id: 'msg-1' }), makeMessage({ id: 'msg-2', content: 'world' })]],
      ]),
    })

    const { updateMessage } = useStore.getState()
    updateMessage('ch-1', 'msg-1', { reactions: [{ emoji: '🎉', userId: 'alice' }] })

    const msgs = useStore.getState().messages.get('ch-1')!
    expect(msgs.find((m) => m.id === 'msg-2')!.reactions).toHaveLength(0)
  })
})

describe('reaction grouping logic', () => {
  it('groups same emoji from different users into a count', () => {
    const reactions = [
      { emoji: '👍', userId: 'alice' },
      { emoji: '👍', userId: 'bob' },
      { emoji: '❤️', userId: 'alice' },
    ]

    const grouped = reactions.reduce<Record<string, number>>((acc, r) => {
      acc[r.emoji] = (acc[r.emoji] ?? 0) + 1
      return acc
    }, {})

    expect(grouped['👍']).toBe(2)
    expect(grouped['❤️']).toBe(1)
  })

  it('returns empty object for no reactions', () => {
    type Reaction = { emoji: string; userId: string }
    const grouped = ([] as Reaction[]).reduce<Record<string, number>>((acc) => acc, {})
    expect(grouped).toEqual({})
  })
})
