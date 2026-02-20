import type { TextareaRenderable } from '@opentui/core'

let _input: TextareaRenderable | null = null

export function registerInputRef(ref: TextareaRenderable | null) {
  _input = ref
}

export function focusInput() {
  _input?.focus()
}
