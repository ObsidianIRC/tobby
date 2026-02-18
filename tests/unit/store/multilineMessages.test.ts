import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/store'
import type { Message } from '@/types'

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'msg-1',
  channelId: 'ch-1',
  serverId: 'srv-1',
  userId: 'alice',
  content: 'line1\nline2\nline3',
  timestamp: new Date(),
  type: 'message',
  reactions: [],
  replyMessage: null,
  mentioned: [],
  ...overrides,
})

describe('multiline message storage', () => {
  beforeEach(() => {
    useStore.setState({ messages: new Map() })
  })

  it('stores a multiline message with isMultiline true', () => {
    const { addMessage } = useStore.getState()
    addMessage(
      'ch-1',
      makeMessage({
        isMultiline: true,
        lines: ['line1', 'line2', 'line3'],
      })
    )

    const msg = useStore.getState().messages.get('ch-1')![0]!
    expect(msg.isMultiline).toBe(true)
  })

  it('stores the lines array', () => {
    const { addMessage } = useStore.getState()
    addMessage(
      'ch-1',
      makeMessage({
        isMultiline: true,
        lines: ['hello', 'world'],
      })
    )

    const msg = useStore.getState().messages.get('ch-1')![0]!
    expect(msg.lines).toEqual(['hello', 'world'])
  })

  it('stores replyMessage when present', () => {
    const reply = makeMessage({ id: 'reply-1', content: 'original' })
    const { addMessage } = useStore.getState()
    addMessage(
      'ch-1',
      makeMessage({
        id: 'msg-2',
        isMultiline: true,
        lines: ['response', 'continued'],
        replyMessage: reply,
      })
    )

    const msg = useStore.getState().messages.get('ch-1')![0]!
    expect(msg.replyMessage?.id).toBe('reply-1')
  })

  it('a regular message has isMultiline undefined', () => {
    const { addMessage } = useStore.getState()
    addMessage('ch-1', makeMessage({ content: 'single line' }))

    const msg = useStore.getState().messages.get('ch-1')![0]!
    expect(msg.isMultiline).toBeUndefined()
  })
})
