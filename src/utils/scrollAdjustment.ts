import type { Message } from '../types'
import { msgLineCount } from './msgLineCount'

const SCROLL_MARGIN = 3

/**
 * Pure scroll-position computation for keyboard message selection.
 *
 * Accepts an optional `lineCount` function so callers that add word-wrap line
 * accounting (e.g. ChatPane) can pass their own enhanced version; the default
 * uses the base utility which only counts logical lines.
 *
 * Returns the new scrollTop value, or null if no scroll is needed.
 */
export function computeScrollAdjustment(
  messages: Message[],
  selected: Message,
  viewportH: number,
  currentScrollTop: number,
  { isEntering = true, goingDown = false }: { isEntering?: boolean; goingDown?: boolean } = {},
  lineCount: (msg: Message, isSelected: boolean) => number = msgLineCount
): number | null {
  const idx = messages.findIndex((m) => m.id === selected.id)
  if (idx === -1) return null

  let startLine = 0
  for (let i = 0; i < idx; i++) {
    const m = messages[i]
    if (m) startLine += lineCount(m, false)
  }
  const selHeight = lineCount(selected, true)
  const endLine = startLine + selHeight

  if (isEntering) {
    if (startLine < currentScrollTop) return startLine
    if (endLine > currentScrollTop + viewportH) return endLine - viewportH
    return null
  }

  if (goingDown) {
    const desired = endLine - viewportH + SCROLL_MARGIN
    return desired > currentScrollTop ? desired : null
  }

  return startLine < currentScrollTop ? startLine : null
}
