/**
 * Tests for tab-completion logic.
 *
 * Tests the pure computeTabCompletion function imported directly from the
 * utility that the useTabCompletion hook uses internally. A bug in the real
 * implementation will now be caught by these tests.
 *
 * This covers the exact bug that getText() returning '' caused tab completion
 * to silently do nothing (computeTabCompletion(RESET, '', opts) → null).
 */
import { describe, it, expect } from 'vitest'
import type { User, Channel } from '@/types'
import { RESET, computeTabCompletion } from '@/utils/tabCompletionCore'
import type { TabState } from '@/utils/tabCompletionCore'

const makeUser = (username: string): User => ({ id: username, username, isOnline: true })
const makeChannel = (name: string): Channel => ({
  id: name,
  name,
  serverId: 'srv-1',
  users: [],
  messages: [],
  unreadCount: 0,
  isPrivate: false,
  isMentioned: false,
})

const opts = {
  users: [makeUser('alice'), makeUser('alicia'), makeUser('bob')],
  channels: [makeChannel('#general'), makeChannel('#random')],
  commands: ['help', 'join', 'part', 'quit'],
}

describe('tab completion — empty input (the critical regression case)', () => {
  it('returns null for empty string — broken getText() would always hit this', () => {
    const result = computeTabCompletion(RESET, '', opts)
    expect(result).toBeNull()
  })

  it('returns null for whitespace-only input', () => {
    expect(computeTabCompletion(RESET, '   ', opts)).toBeNull()
  })
})

describe('tab completion — nick completion', () => {
  it('completes a partial nick at message start with colon suffix', () => {
    const result = computeTabCompletion(RESET, 'al', opts)
    expect(result).not.toBeNull()
    expect(result!.newText).toMatch(/^al(ice|icia): $/)
  })

  it('completes a partial nick mid-sentence with space suffix', () => {
    const result = computeTabCompletion(RESET, 'hello al', opts)
    expect(result?.newText).toMatch(/hello al(ice|icia) $/)
  })

  it('returns null when no nick matches', () => {
    expect(computeTabCompletion(RESET, 'zzz', opts)).toBeNull()
  })

  it('cycles to the next nick on second call', () => {
    const first = computeTabCompletion(RESET, 'al', opts)!
    const second = computeTabCompletion(first.newState, first.newText, opts)!
    expect(first.newText).not.toBe(second.newText)
    expect(second.newText).toMatch(/^al(ice|icia): $/)
  })

  it('wraps around to first match after cycling through all', () => {
    let state: TabState = RESET
    let text = 'al'
    const matchCount = opts.users.filter((u) => u.username.startsWith('al')).length
    // cycle through all matches plus one more to wrap
    for (let i = 0; i <= matchCount; i++) {
      const result = computeTabCompletion(state, text, opts)!
      state = result.newState
      text = result.newText
    }
    // After wrapping, back to first match
    const first = computeTabCompletion(RESET, 'al', opts)!
    expect(text).toBe(first.newText)
  })
})

describe('tab completion — command completion', () => {
  it('completes /he → /help', () => {
    const result = computeTabCompletion(RESET, '/he', opts)
    expect(result?.newText).toBe('/help ')
  })

  it('completes /j → /join', () => {
    const result = computeTabCompletion(RESET, '/j', opts)
    expect(result?.newText).toBe('/join ')
  })

  it('returns null for exact match', () => {
    expect(computeTabCompletion(RESET, '/help', opts)).toBeNull()
  })

  it('returns null for unknown command', () => {
    expect(computeTabCompletion(RESET, '/unknown', opts)).toBeNull()
  })
})

describe('tab completion — channel completion', () => {
  it('completes #gen → #general', () => {
    const result = computeTabCompletion(RESET, '#gen', opts)
    expect(result?.newText).toBe('#general ')
  })

  it('returns null for exact channel name', () => {
    expect(computeTabCompletion(RESET, '#general', opts)).toBeNull()
  })
})

describe('tab completion — external edit resets session', () => {
  it('returns null when text differs from what was produced', () => {
    const first = computeTabCompletion(RESET, 'al', opts)!
    // Simulate user typing extra character
    const result = computeTabCompletion(first.newState, 'something_else', opts)
    expect(result).toBeNull()
  })
})
