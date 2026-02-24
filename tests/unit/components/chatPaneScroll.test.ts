import { describe, it, expect } from 'vitest'
import type { Message } from '@/types'
import { msgLineCount } from '@/utils/msgLineCount'
import { computeScrollAdjustment } from '@/utils/scrollAdjustment'

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

describe('chatPane scroll — keyboard navigation UP (k)', () => {
  it('navigating UP past the viewport top scrolls to show the message', () => {
    const msgs = makeMessages(50)
    const target = msgs[15]! // above viewport showing 20-29
    const result = computeScrollAdjustment(msgs, target, 10, 20, {
      isEntering: false,
      goingDown: false,
    })
    // startLine=15, 15 < 20 → scroll to 15
    expect(result).toBe(15)
  })

  it('navigating UP: no scroll when already visible at top', () => {
    const msgs = makeMessages(50)
    const target = msgs[21]! // inside viewport showing 20-29
    const result = computeScrollAdjustment(msgs, target, 10, 20, {
      isEntering: false,
      goingDown: false,
    })
    // startLine=21, 21 < 20? No → null
    expect(result).toBeNull()
  })
})

describe('chatPane scroll — keyboard navigation DOWN (j)', () => {
  it('navigating DOWN within viewport: no scroll when selection is well within safe area', () => {
    // 50 messages, viewportH=10, current=20 (showing 20-29), MARGIN=3
    const msgs = makeMessages(50)
    const target = msgs[23]! // startLine=23, endLine=25. desired=25-10+3=18. 18 > 20? No → null
    const result = computeScrollAdjustment(msgs, target, 10, 20, {
      isEntering: false,
      goingDown: true,
    })
    expect(result).toBeNull()
  })

  it('navigating DOWN: scrolls eagerly when selection enters safe-area margin', () => {
    // current=20, viewportH=10, MARGIN=3. msg[25]: endLine=27, desired=27-10+3=20. 20>20? No.
    // msg[26]: endLine=28, desired=28-10+3=21. 21>20 → scroll to 21.
    const msgs = makeMessages(50)
    const target = msgs[26]! // startLine=26, endLine=28. desired=28-10+3=21. 21 > 20 → scroll
    const result = computeScrollAdjustment(msgs, target, 10, 20, {
      isEntering: false,
      goingDown: true,
    })
    expect(result).toBe(21)
  })

  it('navigating DOWN past viewport bottom scrolls to keep selection within safe area', () => {
    const msgs = makeMessages(50)
    const target = msgs[30]! // startLine=30, endLine=32. desired=32-10+3=25. 25 > 20 → scroll
    const result = computeScrollAdjustment(msgs, target, 10, 20, {
      isEntering: false,
      goingDown: true,
    })
    expect(result).toBe(25)
  })

  it('navigating DOWN: scrolls forward when message bottom near viewport bottom', () => {
    // current=20, viewportH=10. msg[29] endLine=31. desired=31-10+3=24. 24 > 20 → scroll to 24
    const msgs = makeMessages(50)
    const target = msgs[29]!
    const result = computeScrollAdjustment(msgs, target, 10, 20, {
      isEntering: false,
      goingDown: true,
    })
    expect(result).toBe(24)
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

// Ensure the test uses the same msgLineCount as the utility (smoke-check import)
describe('msgLineCount import sanity', () => {
  it('matches expected line count for a selected message', () => {
    const msg = makeMsg('x')
    expect(msgLineCount(msg, true)).toBe(2) // 1 base + 1 hint row
  })
})
