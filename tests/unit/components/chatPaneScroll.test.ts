import { describe, it, expect } from 'vitest'
import type { Message } from '@/types'

// Mirrors msgLineCount from ChatPane — must stay in sync with the implementation
const msgLineCount = (msg: Message, isSelected: boolean, expandMultilines = false): number => {
  let h = 1
  if (msg.isMultiline && msg.lines && msg.lines.length > 1) {
    if (isSelected || expandMultilines) {
      h += msg.lines.length - 1
    } else {
      h += Math.min(msg.lines.length - 1, 1)
      if (msg.lines.length > 2) h += 1
    }
  }
  if (msg.replyMessage) h += 1
  if (msg.reactions.length > 0) h += 1
  if (isSelected) h += 1
  return h
}

/**
 * Pure version of the scroll adjustment logic in ChatPane's useEffect.
 * Returns the new scrollTop, or null if no adjustment is needed.
 *
 * Rules:
 *   - If the message starts above the visible viewport → scroll up to show its top
 *   - If the message (including hint row when selected) ends below the viewport → scroll down
 *   - Otherwise → no change (return null)
 */
function computeScrollAdjustment(
  messages: Message[],
  selected: Message,
  viewportH: number,
  currentScrollTop: number
): number | null {
  const idx = messages.findIndex((m) => m.id === selected.id)
  if (idx === -1) return null

  let startLine = 0
  for (let i = 0; i < idx; i++) {
    const m = messages[i]
    if (m) startLine += msgLineCount(m, false)
  }
  const selHeight = msgLineCount(selected, true)
  const endLine = startLine + selHeight

  if (startLine < currentScrollTop) {
    return startLine
  }
  if (endLine > currentScrollTop + viewportH) {
    return endLine - viewportH
  }
  return null
}

const makeMsg = (id: string, overrides: Partial<Message> = {}): Message => ({
  id,
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

// Build N simple 1-line messages
const makeMessages = (n: number): Message[] =>
  Array.from({ length: n }, (_, i) => makeMsg(`msg-${i}`))

describe('chatPane scroll — entering selection mode (Ctrl+Space)', () => {
  it('selects last message while at stickyScroll bottom: scrolls down to show hint row', () => {
    // 20 messages, viewportH=10. stickyScroll bottom → current = 20 - 10 = 10
    const msgs = makeMessages(20)
    const last = msgs[19]!
    // current = totalLines - viewportH = 20 - 10 = 10
    const result = computeScrollAdjustment(msgs, last, 10, 10)
    // startLine=19, endLine=21 (1 msg + 1 hint). 21 > 10+10=20 → scroll to 21-10=11
    expect(result).toBe(11)
  })

  it('selects last message on very small screen (viewportH=5)', () => {
    const msgs = makeMessages(50)
    const last = msgs[49]!
    // current = 50 - 5 = 45
    const result = computeScrollAdjustment(msgs, last, 5, 45)
    // startLine=49, endLine=51. 51 > 45+5=50 → scroll to 51-5=46
    expect(result).toBe(46)
  })

  it('no scroll when message with hint row still fits in viewport', () => {
    // 5 messages, viewportH=20 (all fit). current=0
    const msgs = makeMessages(5)
    const last = msgs[4]!
    // startLine=4, endLine=6. 6 > 0+20=20? No. 4 < 0? No. → null
    const result = computeScrollAdjustment(msgs, last, 20, 0)
    expect(result).toBeNull()
  })
})

describe('chatPane scroll — keyboard navigation (j/k)', () => {
  it('navigating UP past the viewport top scrolls to show the message', () => {
    // 50 messages, viewportH=10, currently showing 20-29 (current=20)
    const msgs = makeMessages(50)
    const target = msgs[15]! // above viewport
    const result = computeScrollAdjustment(msgs, target, 10, 20)
    // startLine=15, 15 < 20 → scroll to 15
    expect(result).toBe(15)
  })

  it('navigating DOWN past the viewport bottom scrolls to show hint row', () => {
    // 50 messages, viewportH=10, current=20 (showing 20-29)
    const msgs = makeMessages(50)
    const target = msgs[30]! // hint row at 32, below viewport end 30
    const result = computeScrollAdjustment(msgs, target, 10, 20)
    // startLine=30, endLine=32. 32 > 20+10=30? No. 30 < 20? No.
    // Message at line 30 is right at the edge: viewport shows 20-29, msg at 30 is outside
    // But endLine=32 > 30? Yes. Wait: 32 > 20+10=30 → YES → scroll to 32-10=22
    expect(result).toBe(22)
  })

  it('no scroll when navigating within visible area', () => {
    // 50 messages, viewportH=10, current=20 (showing 20-29)
    const msgs = makeMessages(50)
    const target = msgs[23]! // well inside viewport
    const result = computeScrollAdjustment(msgs, target, 10, 20)
    // startLine=23, endLine=25. 23 < 20? No. 25 > 30? No. → null
    expect(result).toBeNull()
  })

  it('message at exactly the bottom edge: hint row below → scroll by 1', () => {
    // 50 messages, viewportH=10, current=20 (showing 20-29)
    // Select message at line 29 → hint at 31
    const msgs = makeMessages(50)
    const target = msgs[29]!
    const result = computeScrollAdjustment(msgs, target, 10, 20)
    // startLine=29, endLine=31. 31 > 20+10=30? YES → scroll to 31-10=21
    expect(result).toBe(21)
  })
})

describe('chatPane scroll — messages with reactions and replies', () => {
  it('reaction row adds 1 line: hint row may exceed viewport', () => {
    const msgs = makeMessages(20)
    // Last message has a reaction (+1 row), so selected = 1+1+1 = 3 lines
    const last: Message = { ...msgs[19]!, reactions: [{ emoji: '👍', userId: 'bob' }] }
    const msgsWithReaction = [...msgs.slice(0, 19), last]
    // current = 20-10=10 (20 total lines, viewportH=10)
    const result = computeScrollAdjustment(msgsWithReaction, last, 10, 10)
    // startLine=19, endLine=22 (1 msg + 1 reaction + 1 hint). 22 > 10+10=20 → scroll to 22-10=12
    expect(result).toBe(12)
  })

  it('reply preview adds 1 line: hint row may exceed viewport', () => {
    const msgs = makeMessages(20)
    const replyMsg = msgs[0]!
    const last: Message = { ...msgs[19]!, replyMessage: replyMsg }
    const msgsWithReply = [...msgs.slice(0, 19), last]
    // current = 20-10=10
    const result = computeScrollAdjustment(msgsWithReply, last, 10, 10)
    // startLine=19, endLine=22 (1 reply + 1 msg + 1 hint). 22 > 20 → scroll to 12
    expect(result).toBe(12)
  })
})

describe('chatPane scroll — edge cases', () => {
  it('selecting a message when no messages exist returns null', () => {
    const msg = makeMsg('x')
    // msg not in empty list → idx = -1
    const result = computeScrollAdjustment([], msg, 10, 0)
    expect(result).toBeNull()
  })

  it('selecting the first message while viewport is at bottom scrolls to top', () => {
    const msgs = makeMessages(50)
    const first = msgs[0]!
    // current = 40 (at bottom, viewportH=10)
    const result = computeScrollAdjustment(msgs, first, 10, 40)
    // startLine=0, 0 < 40 → scroll to 0
    expect(result).toBe(0)
  })

  it('last message with non-selectable messages appended after it', () => {
    // Simulates join/part/system messages after the last chat message.
    // Last selectable msg is at index 17, but there are 2 system msgs after.
    const msgs = makeMessages(20)
    const lastSelectable = msgs[17]!
    // total lines = 20, current = 20-10=10, viewportH=10
    const result = computeScrollAdjustment(msgs, lastSelectable, 10, 10)
    // startLine=17, endLine=19. 17 < 10? No. 19 > 10+10=20? No. → null (already visible)
    expect(result).toBeNull()
  })
})
