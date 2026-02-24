import { describe, it, expect } from 'vitest'
import type { Message } from '@/types'
import { msgLineCount, visibleLines, hiddenCount } from '@/utils/msgLineCount'

const base: Message = {
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
}

describe('msgLineCount — single-line messages', () => {
  it('1-line message = 1 row', () => {
    expect(msgLineCount(base, false)).toBe(1)
  })

  it('1-line selected = 2 rows (message + hints)', () => {
    expect(msgLineCount(base, true)).toBe(2)
  })

  it('adds 1 row when replyMessage present', () => {
    const msg: Message = { ...base, replyMessage: { ...base, id: 'reply-1' } }
    expect(msgLineCount(msg, false)).toBe(2)
  })

  it('adds 1 row when reactions present', () => {
    const msg: Message = { ...base, reactions: [{ emoji: '👍', userId: 'bob' }] }
    expect(msgLineCount(msg, false)).toBe(2)
  })

  it('reply + reactions + selected = 4 rows', () => {
    const msg: Message = {
      ...base,
      replyMessage: { ...base, id: 'reply-1' },
      reactions: [{ emoji: '👍', userId: 'bob' }],
    }
    expect(msgLineCount(msg, true)).toBe(4)
  })
})

describe('msgLineCount — multiline messages (collapsed)', () => {
  it('2-line multiline = 2 rows (first + second line)', () => {
    const msg: Message = { ...base, isMultiline: true, lines: ['a', 'b'] }
    expect(msgLineCount(msg, false)).toBe(2)
  })

  it('3-line multiline = 3 rows (first, second, chevron)', () => {
    const msg: Message = { ...base, isMultiline: true, lines: ['a', 'b', 'c'] }
    expect(msgLineCount(msg, false)).toBe(3)
  })

  it('4-line multiline = 3 rows (first, second, chevron — 2 lines hidden)', () => {
    const msg: Message = { ...base, isMultiline: true, lines: ['a', 'b', 'c', 'd'] }
    expect(msgLineCount(msg, false)).toBe(3)
  })

  it('10-line multiline still = 3 rows collapsed', () => {
    const msg: Message = {
      ...base,
      isMultiline: true,
      lines: Array.from({ length: 10 }, (_, i) => `line${i}`),
    }
    expect(msgLineCount(msg, false)).toBe(3)
  })

  it('multiline with reply = 3 rows for 2 lines + 1 reply', () => {
    const msg: Message = {
      ...base,
      isMultiline: true,
      lines: ['a', 'b'],
      replyMessage: { ...base, id: 'reply-1' },
    }
    expect(msgLineCount(msg, false)).toBe(3)
  })
})

describe('msgLineCount — multiline messages (expanded / selected)', () => {
  it('2-line multiline selected = 3 rows (2 lines + hints)', () => {
    const msg: Message = { ...base, isMultiline: true, lines: ['a', 'b'] }
    expect(msgLineCount(msg, true)).toBe(3)
  })

  it('3-line multiline selected = 4 rows (3 lines + hints)', () => {
    const msg: Message = { ...base, isMultiline: true, lines: ['a', 'b', 'c'] }
    expect(msgLineCount(msg, true)).toBe(4)
  })

  it('5-line multiline selected = 6 rows (5 lines + hints)', () => {
    const msg: Message = {
      ...base,
      isMultiline: true,
      lines: ['a', 'b', 'c', 'd', 'e'],
    }
    expect(msgLineCount(msg, true)).toBe(6)
  })

  it('3-line multiline selected with reply = 5 rows', () => {
    const msg: Message = {
      ...base,
      isMultiline: true,
      lines: ['a', 'b', 'c'],
      replyMessage: { ...base, id: 'reply-1' },
    }
    // 1 (first) + 2 (remaining) + 1 (reply) + 1 (hints) = 5
    expect(msgLineCount(msg, true)).toBe(5)
  })

  it('3-line multiline selected with reactions = 5 rows', () => {
    const msg: Message = {
      ...base,
      isMultiline: true,
      lines: ['a', 'b', 'c'],
      reactions: [{ emoji: '❤️', userId: 'bob' }],
    }
    expect(msgLineCount(msg, true)).toBe(5)
  })
})

describe('MultilineMessageView visible lines logic', () => {
  it('collapsed: shows at most 2 lines', () => {
    const msg: Message = { ...base, isMultiline: true, lines: ['a', 'b', 'c', 'd'] }
    expect(visibleLines(msg, false)).toEqual(['a', 'b'])
  })

  it('collapsed: shows both lines when exactly 2', () => {
    const msg: Message = { ...base, isMultiline: true, lines: ['x', 'y'] }
    expect(visibleLines(msg, false)).toEqual(['x', 'y'])
  })

  it('expanded: shows all lines', () => {
    const msg: Message = {
      ...base,
      isMultiline: true,
      lines: ['a', 'b', 'c', 'd', 'e'],
    }
    expect(visibleLines(msg, true)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('falls back to splitting content when lines missing', () => {
    const msg: Message = { ...base, content: 'foo\nbar\nbaz' }
    expect(visibleLines(msg, false)).toEqual(['foo', 'bar'])
    expect(visibleLines(msg, true)).toEqual(['foo', 'bar', 'baz'])
  })
})

describe('MultilineMessageView chevron / hidden count', () => {
  it('hiddenCount is 0 for 2 lines (no chevron needed)', () => {
    const msg: Message = { ...base, isMultiline: true, lines: ['a', 'b'] }
    expect(hiddenCount(msg)).toBe(0)
  })

  it('hiddenCount is 1 for 3 lines', () => {
    const msg: Message = { ...base, isMultiline: true, lines: ['a', 'b', 'c'] }
    expect(hiddenCount(msg)).toBe(1)
  })

  it('hiddenCount is 8 for 10 lines', () => {
    const msg: Message = {
      ...base,
      isMultiline: true,
      lines: Array.from({ length: 10 }, (_, i) => `line${i}`),
    }
    expect(hiddenCount(msg)).toBe(8)
  })
})
