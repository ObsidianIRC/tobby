import { useCallback, useRef, useState } from 'react'
import type { User, Channel } from '../types'

interface TabState {
  isActive: boolean
  matches: string[] // full replacement strings (already include suffix)
  currentIndex: number
  originalText: string // text at the moment completion started
  completionStart: number // char offset where the current word begins
  originalWord: string // the partial word that triggered completion
}

const RESET: TabState = {
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

export function useTabCompletion() {
  const [state, setState] = useState<TabState>(RESET)
  // Tracks the last text value we produced so we can detect external edits
  const lastProducedRef = useRef<string>('')

  const resetCompletion = useCallback(() => {
    setState(RESET)
    lastProducedRef.current = ''
  }, [])

  const handleTabCompletion = useCallback(
    (
      currentText: string,
      { users, channels, commands }: TabCompletionOptions
    ): { newText: string; newCursorPosition: number } | null => {
      // User edited the text outside of tab cycling — reset session
      if (state.isActive && currentText !== lastProducedRef.current) {
        setState(RESET)
        lastProducedRef.current = ''
        return null
      }

      // Cursor is at the end in a terminal single-line input
      const cursorPosition = currentText.length
      const textBeforeCursor = currentText.substring(0, cursorPosition)

      // Find the word under the cursor (last whitespace-delimited token)
      const words = textBeforeCursor.split(/\s+/)
      const currentWord = words[words.length - 1] ?? ''
      const completionStart = cursorPosition - currentWord.length

      if (!state.isActive) {
        // ── Initiate a new completion session ────────────────────────────────
        if (currentWord.length === 0) return null

        const isAtMessageStart = textBeforeCursor.trim() === currentWord
        let candidates: string[]

        if (currentWord.startsWith('/')) {
          const partial = currentWord.slice(1).toLowerCase()
          candidates = commands
            .filter((cmd) => cmd.startsWith(partial) && cmd !== partial)
            .sort((a, b) => a.localeCompare(b))
            .map((cmd) => `/${cmd} `)
        } else if (currentWord.startsWith('#')) {
          const partial = currentWord.toLowerCase()
          candidates = channels
            .map((ch) => ch.name)
            .filter(
              (name) => name.toLowerCase().startsWith(partial) && name.toLowerCase() !== partial
            )
            .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
            .map((name) => `${name} `)
        } else {
          // Nick completion — `: ` suffix at message start, ` ` elsewhere
          const partial = currentWord.toLowerCase()
          const suffix = isAtMessageStart ? ': ' : ' '
          candidates = users
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
          currentText.substring(0, completionStart) +
          selected +
          currentText.substring(cursorPosition)
        const newCursorPosition = completionStart + selected.length

        setState({
          isActive: true,
          matches: candidates,
          currentIndex: 0,
          originalText: currentText,
          completionStart,
          originalWord: currentWord,
        })

        lastProducedRef.current = newText
        return { newText, newCursorPosition }
      }

      // ── Cycle through existing matches ────────────────────────────────────
      const nextIndex = (state.currentIndex + 1) % state.matches.length
      const selected = state.matches[nextIndex]!

      const newText =
        state.originalText.substring(0, state.completionStart) +
        selected +
        state.originalText.substring(state.completionStart + state.originalWord.length)
      const newCursorPosition = state.completionStart + selected.length

      setState((prev) => ({ ...prev, currentIndex: nextIndex }))
      lastProducedRef.current = newText
      return { newText, newCursorPosition }
    },
    [state]
  )

  return { handleTabCompletion, resetCompletion, isActive: state.isActive }
}
