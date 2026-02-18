import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/store'

// Mirrors the height cap logic from CommandInput and MainLayout
const cappedLines = (n: number) => Math.min(n, 5)
const commandInputHeight = (lineCount: number, quitWarning: boolean) =>
  1 + cappedLines(lineCount) + (quitWarning ? 1 : 0)

describe('inputLineCount store', () => {
  beforeEach(() => {
    useStore.setState({ inputLineCount: 1 })
  })

  it('defaults to 1', () => {
    expect(useStore.getState().inputLineCount).toBe(1)
  })

  it('setInputLineCount persists the value', () => {
    useStore.getState().setInputLineCount(3)
    expect(useStore.getState().inputLineCount).toBe(3)
  })

  it('can be reset to 1', () => {
    useStore.getState().setInputLineCount(5)
    useStore.getState().setInputLineCount(1)
    expect(useStore.getState().inputLineCount).toBe(1)
  })

  it('accepts values beyond the visual cap', () => {
    useStore.getState().setInputLineCount(10)
    expect(useStore.getState().inputLineCount).toBe(10)
  })

  it('is independent of other UI state', () => {
    useStore.setState({ quitWarning: 'press again to quit' })
    useStore.getState().setInputLineCount(3)
    expect(useStore.getState().inputLineCount).toBe(3)
    expect(useStore.getState().quitWarning).toBe('press again to quit')
  })
})

describe('input box height calculation', () => {
  it('1-line input without quit warning = height 2', () => {
    expect(commandInputHeight(1, false)).toBe(2)
  })

  it('3-line input without quit warning = height 4', () => {
    expect(commandInputHeight(3, false)).toBe(4)
  })

  it('5-line input without quit warning = height 6 (max visual)', () => {
    expect(commandInputHeight(5, false)).toBe(6)
  })

  it('6-line input is capped at 5 visible rows = height 6', () => {
    expect(commandInputHeight(6, false)).toBe(6)
  })

  it('100-line input is capped at 5 visible rows = height 6', () => {
    expect(commandInputHeight(100, false)).toBe(6)
  })

  it('1-line input with quit warning = height 3', () => {
    expect(commandInputHeight(1, true)).toBe(3)
  })

  it('5-line input with quit warning = height 7', () => {
    expect(commandInputHeight(5, true)).toBe(7)
  })
})
