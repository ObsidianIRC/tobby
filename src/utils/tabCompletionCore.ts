import type { User, Channel } from '../types'

export interface TabState {
  isActive: boolean
  matches: string[]
  currentIndex: number
  originalText: string
  completionStart: number
  originalWord: string
}

export const RESET: TabState = {
  isActive: false,
  matches: [],
  currentIndex: 0,
  originalText: '',
  completionStart: 0,
  originalWord: '',
}

export interface TabCompletionOptions {
  users: User[]
  channels: Channel[]
  commands: string[]
}

/**
 * Pure tab-completion computation.
 *
 * Given the current completion state and the input text, returns the next
 * completion result or null (no match, or text was externally edited and the
 * caller should reset to RESET).
 */
export function computeTabCompletion(
  state: TabState,
  currentText: string,
  opts: TabCompletionOptions
): { newText: string; completionStart: number; newState: TabState } | null {
  // Derive what text we would have produced from the current completion state
  const lastProduced =
    state.isActive && state.matches[state.currentIndex] != null
      ? state.originalText.substring(0, state.completionStart) +
        state.matches[state.currentIndex]! +
        state.originalText.substring(state.completionStart + state.originalWord.length)
      : ''

  // User edited text outside of tab cycling — caller should reset state
  if (state.isActive && currentText !== lastProduced) {
    return null
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
      completionStart,
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

  // Cycle through existing matches
  const nextIndex = (state.currentIndex + 1) % state.matches.length
  const selected = state.matches[nextIndex]!
  const newText =
    state.originalText.substring(0, state.completionStart) +
    selected +
    state.originalText.substring(state.completionStart + state.originalWord.length)

  return {
    newText,
    completionStart: state.completionStart,
    newState: { ...state, currentIndex: nextIndex },
  }
}
