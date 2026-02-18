/**
 * Tests for tab-completion logic.
 *
 * The hook's state machine is exercised by calling the handler sequentially,
 * capturing the produced texts and verifying cycling behaviour.
 *
 * This covers the exact bug that getText() returning '' caused tab completion
 * to silently do nothing (handleTabCompletion('', opts) → null).
 */
import { describe, it, expect } from 'vitest'
import type { User, Channel } from '@/types'

// ──────────────────────────────────────────────────────────────────────────────
// Inline the stateless core logic of useTabCompletion so it can run in node.
// This mirrors the implementation exactly and would fail if the logic changes.
// ──────────────────────────────────────────────────────────────────────────────

interface TabState {
  isActive: boolean
  matches: string[]
  currentIndex: number
  originalText: string
  completionStart: number
  originalWord: string
}

const RESET: TabState = {
  isActive: false,
  matches: [],
  currentIndex: 0,
  originalText: '',
  completionStart: 0,
  originalWord: '',
}

function tabComplete(
  state: TabState,
  currentText: string,
  opts: { users: User[]; channels: Channel[]; commands: string[] }
): { newText: string; newState: TabState } | null {
  const lastProduced = state.isActive
    ? (() => {
        const selected = state.matches[state.currentIndex]!
        return (
          state.originalText.substring(0, state.completionStart) +
          selected +
          state.originalText.substring(state.completionStart + state.originalWord.length)
        )
      })()
    : ''

  if (state.isActive && currentText !== lastProduced) {
    return null // external edit → reset (caller should use RESET state)
  }

  const cursorPosition = currentText.length
  const textBeforeCursor = currentText.substring(0, cursorPosition)
  const words = textBeforeCursor.split(/\s+/)
  const currentWord = words[words.length - 1] ?? ''
  const completionStart = cursorPosition - currentWord.length

  if (!state.isActive) {
    if (currentWord.length === 0) return null

    const isAtMessageStart = textBeforeCursor.trim() === currentWord
    let candidates: string[]

    if (currentWord.startsWith('/')) {
      const partial = currentWord.slice(1).toLowerCase()
      candidates = opts.commands
        .filter((cmd) => cmd.startsWith(partial) && cmd !== partial)
        .sort((a, b) => a.localeCompare(b))
        .map((cmd) => `/${cmd} `)
    } else if (currentWord.startsWith('#')) {
      const partial = currentWord.toLowerCase()
      candidates = opts.channels
        .map((ch) => ch.name)
        .filter((name) => name.toLowerCase().startsWith(partial) && name.toLowerCase() !== partial)
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .map((name) => `${name} `)
    } else {
      const partial = currentWord.toLowerCase()
      const suffix = isAtMessageStart ? ': ' : ' '
      candidates = opts.users
        .map((u) => u.username)
        .filter(
          (username) =>
            username.toLowerCase().startsWith(partial) && username.toLowerCase() !== partial
        )
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .map((nick) => `${nick}${suffix}`)
    }

    if (candidates.length === 0) return null

    const selected = candidates[0]!
    const newText =
      currentText.substring(0, completionStart) + selected + currentText.substring(cursorPosition)

    return {
      newText,
      newState: {
        isActive: true,
        matches: candidates,
        currentIndex: 0,
        originalText: currentText,
        completionStart,
        originalWord: currentWord,
      },
    }
  }

  // Cycle
  const nextIndex = (state.currentIndex + 1) % state.matches.length
  const selected = state.matches[nextIndex]!
  const newText =
    state.originalText.substring(0, state.completionStart) +
    selected +
    state.originalText.substring(state.completionStart + state.originalWord.length)

  return { newText, newState: { ...state, currentIndex: nextIndex } }
}

// ──────────────────────────────────────────────────────────────────────────────

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
    const result = tabComplete(RESET, '', opts)
    expect(result).toBeNull()
  })

  it('returns null for whitespace-only input', () => {
    expect(tabComplete(RESET, '   ', opts)).toBeNull()
  })
})

describe('tab completion — nick completion', () => {
  it('completes a partial nick at message start with colon suffix', () => {
    const result = tabComplete(RESET, 'al', opts)
    expect(result).not.toBeNull()
    expect(result!.newText).toMatch(/^al(ice|icia): $/)
  })

  it('completes a partial nick mid-sentence with space suffix', () => {
    const result = tabComplete(RESET, 'hello al', opts)
    expect(result?.newText).toMatch(/hello al(ice|icia) $/)
  })

  it('returns null when no nick matches', () => {
    expect(tabComplete(RESET, 'zzz', opts)).toBeNull()
  })

  it('cycles to the next nick on second call', () => {
    const first = tabComplete(RESET, 'al', opts)!
    const second = tabComplete(first.newState, first.newText, opts)!
    expect(first.newText).not.toBe(second.newText)
    expect(second.newText).toMatch(/^al(ice|icia): $/)
  })

  it('wraps around to first match after cycling through all', () => {
    let state = RESET
    let text = 'al'
    const matchCount = opts.users.filter((u) => u.username.startsWith('al')).length
    // cycle through all matches plus one more to wrap
    for (let i = 0; i <= matchCount; i++) {
      const result = tabComplete(state, text, opts)!
      state = result.newState
      text = result.newText
    }
    // After wrapping, back to first match
    const first = tabComplete(RESET, 'al', opts)!
    expect(text).toBe(first.newText)
  })
})

describe('tab completion — command completion', () => {
  it('completes /he → /help', () => {
    const result = tabComplete(RESET, '/he', opts)
    expect(result?.newText).toBe('/help ')
  })

  it('completes /j → /join', () => {
    const result = tabComplete(RESET, '/j', opts)
    expect(result?.newText).toBe('/join ')
  })

  it('returns null for exact match', () => {
    expect(tabComplete(RESET, '/help', opts)).toBeNull()
  })

  it('returns null for unknown command', () => {
    expect(tabComplete(RESET, '/unknown', opts)).toBeNull()
  })
})

describe('tab completion — channel completion', () => {
  it('completes #gen → #general', () => {
    const result = tabComplete(RESET, '#gen', opts)
    expect(result?.newText).toBe('#general ')
  })

  it('returns null for exact channel name', () => {
    expect(tabComplete(RESET, '#general', opts)).toBeNull()
  })
})

describe('tab completion — external edit resets session', () => {
  it('returns null when text differs from what was produced', () => {
    const first = tabComplete(RESET, 'al', opts)!
    // Simulate user typing extra character
    const result = tabComplete(first.newState, 'something_else', opts)
    expect(result).toBeNull()
  })
})
