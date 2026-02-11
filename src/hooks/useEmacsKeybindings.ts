interface EmacsKeybindingsConfig {
  input: string
  setInput: (value: string | ((prev: string) => string)) => void
  cursorPosition?: number
  setCursorPosition?: (pos: number) => void
  onSubmit?: () => void
  onNewline?: () => void
}

export function handleEmacsKeybindings(
  key: { name?: string; ctrl?: boolean; meta?: boolean; shift?: boolean; sequence?: string },
  config: EmacsKeybindingsConfig
): boolean {
  const { input, setInput, cursorPosition = input.length, setCursorPosition } = config

  if (key.ctrl && key.name === 'a') {
    setCursorPosition?.(0)
    return true
  }

  if (key.ctrl && key.name === 'e') {
    setCursorPosition?.(input.length)
    return true
  }

  if (key.ctrl && key.name === 'u') {
    const after = input.slice(cursorPosition)
    setInput(after)
    setCursorPosition?.(0)
    return true
  }

  if (key.ctrl && key.name === 'k') {
    const before = input.slice(0, cursorPosition)
    setInput(before)
    return true
  }

  if (key.meta && key.name === 'backspace') {
    const before = input.slice(0, cursorPosition)
    const after = input.slice(cursorPosition)

    const wordStart = before.trimEnd().lastIndexOf(' ')
    const newBefore = wordStart === -1 ? '' : before.slice(0, wordStart + 1)

    setInput(newBefore + after)
    setCursorPosition?.(newBefore.length)
    return true
  }

  if (key.meta && key.name === 'd') {
    const before = input.slice(0, cursorPosition)
    const after = input.slice(cursorPosition)

    const wordEnd = after.trimStart().indexOf(' ')
    const newAfter = wordEnd === -1 ? '' : after.slice(wordEnd)

    setInput(before + newAfter)
    return true
  }

  if (key.ctrl && key.name === 'w') {
    const before = input.slice(0, cursorPosition)
    const after = input.slice(cursorPosition)

    const wordStart = before.trimEnd().lastIndexOf(' ')
    const newBefore = wordStart === -1 ? '' : before.slice(0, wordStart + 1)

    setInput(newBefore + after)
    setCursorPosition?.(newBefore.length)
    return true
  }

  return false
}
