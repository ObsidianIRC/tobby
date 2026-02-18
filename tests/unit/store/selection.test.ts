import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/store'
import type { Message } from '@/types'

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'msg-1',
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

describe('message selection store', () => {
  beforeEach(() => {
    useStore.setState({ selectedMessage: null, replyingTo: null })
  })

  it('sets and clears selectedMessage', () => {
    const msg = makeMessage()
    useStore.getState().setSelectedMessage(msg)
    expect(useStore.getState().selectedMessage?.id).toBe('msg-1')

    useStore.getState().setSelectedMessage(null)
    expect(useStore.getState().selectedMessage).toBeNull()
  })

  it('sets and clears replyingTo', () => {
    const msg = makeMessage()
    useStore.getState().setReplyingTo(msg)
    expect(useStore.getState().replyingTo?.id).toBe('msg-1')

    useStore.getState().setReplyingTo(null)
    expect(useStore.getState().replyingTo).toBeNull()
  })

  it('selectedMessage and replyingTo are independent', () => {
    const msg1 = makeMessage({ id: 'msg-1' })
    const msg2 = makeMessage({ id: 'msg-2' })

    useStore.getState().setSelectedMessage(msg1)
    useStore.getState().setReplyingTo(msg2)

    expect(useStore.getState().selectedMessage?.id).toBe('msg-1')
    expect(useStore.getState().replyingTo?.id).toBe('msg-2')
  })

  it('replacing selectedMessage with a new one works', () => {
    const msg1 = makeMessage({ id: 'msg-1' })
    const msg2 = makeMessage({ id: 'msg-2' })

    useStore.getState().setSelectedMessage(msg1)
    useStore.getState().setSelectedMessage(msg2)

    expect(useStore.getState().selectedMessage?.id).toBe('msg-2')
  })
})
