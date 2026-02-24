import { useCallback, useRef, useState } from 'react'
import {
  RESET,
  computeTabCompletion,
  type TabState,
  type TabCompletionOptions,
} from '../utils/tabCompletionCore'

export function useTabCompletion() {
  const [state, setState] = useState<TabState>(RESET)
  // Tracks the last text value we produced so we can detect external edits
  // synchronously (setState is batched; the ref is always current).
  const lastProducedRef = useRef<string>('')

  const resetCompletion = useCallback(() => {
    setState(RESET)
    lastProducedRef.current = ''
  }, [])

  const handleTabCompletion = useCallback(
    (
      currentText: string,
      opts: TabCompletionOptions
    ): { newText: string; newCursorPosition: number } | null => {
      // Use the ref for external-edit detection — more reliable than deriving
      // from state since setState is batched but the ref is always synchronous.
      if (state.isActive && currentText !== lastProducedRef.current) {
        setState(RESET)
        lastProducedRef.current = ''
        return null
      }

      const result = computeTabCompletion(state, currentText, opts)
      if (!result) return null

      const { newText, completionStart, newState } = result
      const selected = newState.matches[newState.currentIndex]!
      const newCursorPosition = completionStart + selected.length

      setState(newState)
      lastProducedRef.current = newText
      return { newText, newCursorPosition }
    },
    [state]
  )

  return { handleTabCompletion, resetCompletion, isActive: state.isActive }
}
