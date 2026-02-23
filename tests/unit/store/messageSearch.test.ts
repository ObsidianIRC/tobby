import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/store'
import { stripIrcFormatting } from '@/utils/ircFormatting'
import type { Message } from '@/types'

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'msg-1',
  channelId: 'ch-1',
  serverId: 'srv-1',
  userId: 'alice',
  content: 'hello world',
  timestamp: new Date(),
  type: 'message',
  reactions: [],
  replyMessage: null,
  mentioned: [],
  ...overrides,
})

const computeMatches = (messages: Message[], query: string): string[] => {
  if (!query.trim()) return []
  const lower = query.toLowerCase()
  return messages
    .filter((m) => m.type === 'message' || m.type === 'action')
    .filter((m) =>
      (stripIrcFormatting(m.content).split('\n')[0] ?? '').toLowerCase().includes(lower)
    )
    .map((m) => m.id)
    .reverse()
}

// ---------------------------------------------------------------------------
// Store: search state management
// ---------------------------------------------------------------------------

describe('messageSearch store state', () => {
  beforeEach(() => {
    useStore.setState({ messageSearch: null, selectedMessage: null, currentChannelId: null })
  })

  it('starts as null', () => {
    expect(useStore.getState().messageSearch).toBeNull()
  })

  it('setMessageSearch sets the full state', () => {
    useStore.getState().setMessageSearch({
      query: 'hello',
      matchIds: ['msg-1', 'msg-2'],
      currentIndex: 0,
      typing: true,
    })
    const s = useStore.getState().messageSearch
    expect(s?.query).toBe('hello')
    expect(s?.matchIds).toEqual(['msg-1', 'msg-2'])
    expect(s?.currentIndex).toBe(0)
    expect(s?.typing).toBe(true)
  })

  it('setMessageSearch(null) clears the search', () => {
    useStore
      .getState()
      .setMessageSearch({ query: 'hello', matchIds: [], currentIndex: 0, typing: true })
    useStore.getState().setMessageSearch(null)
    expect(useStore.getState().messageSearch).toBeNull()
  })

  it('setCurrentChannel clears messageSearch', () => {
    useStore
      .getState()
      .setMessageSearch({ query: 'test', matchIds: ['msg-1'], currentIndex: 0, typing: false })
    useStore.getState().setCurrentChannel('ch-2')
    expect(useStore.getState().messageSearch).toBeNull()
  })

  it('setSelectedMessage(msg) does NOT clear messageSearch', () => {
    useStore
      .getState()
      .setMessageSearch({ query: 'test', matchIds: ['msg-1'], currentIndex: 0, typing: false })
    useStore.getState().setSelectedMessage(makeMessage())
    expect(useStore.getState().messageSearch).not.toBeNull()
  })

  it('setSelectedMessage(null) clears messageSearch — shared exit behaviour', () => {
    useStore
      .getState()
      .setMessageSearch({ query: 'test', matchIds: ['msg-1'], currentIndex: 0, typing: false })
    useStore.getState().setSelectedMessage(makeMessage())
    useStore.getState().setSelectedMessage(null)
    expect(useStore.getState().messageSearch).toBeNull()
    expect(useStore.getState().selectedMessage).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// State transitions driven by keyboard events
// ---------------------------------------------------------------------------

describe('messageSearch typing focus transitions', () => {
  beforeEach(() => {
    useStore.setState({ messageSearch: null, selectedMessage: null })
  })

  it('opening search starts with typing: true (input focused)', () => {
    useStore.getState().setMessageSearch({ query: '', matchIds: [], currentIndex: 0, typing: true })
    expect(useStore.getState().messageSearch?.typing).toBe(true)
  })

  it('Enter while typing unfocuses the input (typing → false)', () => {
    useStore
      .getState()
      .setMessageSearch({ query: 'hi', matchIds: ['msg-1'], currentIndex: 0, typing: true })
    const s = useStore.getState().messageSearch!
    useStore.getState().setMessageSearch({ ...s, typing: false })
    expect(useStore.getState().messageSearch?.typing).toBe(false)
  })

  it('pressing / while not typing re-focuses the input (typing → true)', () => {
    useStore
      .getState()
      .setMessageSearch({ query: 'hi', matchIds: ['msg-1'], currentIndex: 0, typing: false })
    const s = useStore.getState().messageSearch!
    useStore.getState().setMessageSearch({ ...s, typing: true })
    expect(useStore.getState().messageSearch?.typing).toBe(true)
  })

  it('Esc clears messageSearch and selectedMessage regardless of typing state', () => {
    useStore
      .getState()
      .setMessageSearch({ query: 'hi', matchIds: ['msg-1'], currentIndex: 0, typing: true })
    useStore.getState().setSelectedMessage(makeMessage())
    // Esc handler: setSelectedMessage(null) is enough — it clears messageSearch too
    useStore.getState().setSelectedMessage(null)
    expect(useStore.getState().messageSearch).toBeNull()
    expect(useStore.getState().selectedMessage).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// n / p navigation
// ---------------------------------------------------------------------------

describe('messageSearch n/p navigation', () => {
  const matches = ['msg-1', 'msg-2', 'msg-3']

  beforeEach(() => {
    useStore.setState({
      messageSearch: { query: 'hi', matchIds: matches, currentIndex: 0, typing: false },
      selectedMessage: null,
    })
  })

  it('p goes to older match (currentIndex + 1)', () => {
    const s = useStore.getState().messageSearch!
    const older = s.currentIndex + 1
    if (older < s.matchIds.length) {
      useStore.getState().setMessageSearch({ ...s, currentIndex: older })
    }
    expect(useStore.getState().messageSearch?.currentIndex).toBe(1)
  })

  it('n goes to newer match (currentIndex - 1)', () => {
    useStore.getState().setMessageSearch({
      query: 'hi',
      matchIds: matches,
      currentIndex: 2,
      typing: false,
    })
    const s = useStore.getState().messageSearch!
    const newer = s.currentIndex - 1
    if (newer >= 0) {
      useStore.getState().setMessageSearch({ ...s, currentIndex: newer })
    }
    expect(useStore.getState().messageSearch?.currentIndex).toBe(1)
  })

  it('p does not go past the oldest match', () => {
    useStore.getState().setMessageSearch({
      query: 'hi',
      matchIds: matches,
      currentIndex: 2,
      typing: false,
    })
    const s = useStore.getState().messageSearch!
    const older = s.currentIndex + 1
    if (older < s.matchIds.length) {
      useStore.getState().setMessageSearch({ ...s, currentIndex: older })
    }
    expect(useStore.getState().messageSearch?.currentIndex).toBe(2)
  })

  it('n does not go below 0 (already at newest)', () => {
    const s = useStore.getState().messageSearch!
    const newer = s.currentIndex - 1
    if (newer >= 0) {
      useStore.getState().setMessageSearch({ ...s, currentIndex: newer })
    }
    expect(useStore.getState().messageSearch?.currentIndex).toBe(0)
  })

  it('query is preserved while navigating', () => {
    const s = useStore.getState().messageSearch!
    useStore.getState().setMessageSearch({ ...s, currentIndex: 1 })
    expect(useStore.getState().messageSearch?.query).toBe('hi')
  })
})

// ---------------------------------------------------------------------------
// Match computation
// ---------------------------------------------------------------------------

describe('search match computation', () => {
  it('returns empty array for blank query', () => {
    const msgs = [makeMessage({ id: '1', content: 'hello' })]
    expect(computeMatches(msgs, '')).toEqual([])
    expect(computeMatches(msgs, '   ')).toEqual([])
  })

  it('matches case-insensitively', () => {
    const msgs = [makeMessage({ id: '1', content: 'Hello World' })]
    expect(computeMatches(msgs, 'hello')).toEqual(['1'])
    expect(computeMatches(msgs, 'HELLO')).toEqual(['1'])
    expect(computeMatches(msgs, 'WORLD')).toEqual(['1'])
  })

  it('returns only messages containing the query', () => {
    const msgs = [
      makeMessage({ id: '1', content: 'hello world' }),
      makeMessage({ id: '2', content: 'goodbye world' }),
      makeMessage({ id: '3', content: 'hello again' }),
    ]
    const result = computeMatches(msgs, 'hello')
    expect(result).toEqual(['3', '1'])
  })

  it('returns results newest-first (array reversed)', () => {
    const msgs = [
      makeMessage({ id: 'old', content: 'foo' }),
      makeMessage({ id: 'mid', content: 'foo' }),
      makeMessage({ id: 'new', content: 'foo' }),
    ]
    expect(computeMatches(msgs, 'foo')).toEqual(['new', 'mid', 'old'])
  })

  it('only matches message and action types, not join/part/system etc.', () => {
    const msgs = [
      makeMessage({ id: '1', content: 'hello', type: 'message' }),
      makeMessage({ id: '2', content: 'hello', type: 'action' }),
      makeMessage({ id: '3', content: 'hello', type: 'join' }),
      makeMessage({ id: '4', content: 'hello', type: 'system' }),
    ]
    expect(computeMatches(msgs, 'hello')).toEqual(['2', '1'])
  })

  it('matches only against the first line of multi-line content', () => {
    const msgs = [
      makeMessage({ id: '1', content: 'first line\nhello on second' }),
      makeMessage({ id: '2', content: 'hello on first\nsecond line' }),
    ]
    expect(computeMatches(msgs, 'hello')).toEqual(['2'])
  })

  it('returns empty array when no messages match', () => {
    const msgs = [makeMessage({ id: '1', content: 'unrelated content' })]
    expect(computeMatches(msgs, 'xyz')).toEqual([])
  })
})
