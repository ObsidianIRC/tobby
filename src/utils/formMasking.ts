const MASK = '*'

/**
 * Given the masked display string from onInput and the previous real value,
 * recover what the new real value should be.
 *
 * When the user types a real character, it appears as-is in the display string
 * because setText hasn't masked it yet. All previously masked chars are MASK (*).
 * Non-MASK chars in the display are the newly added real characters.
 * A shorter display length means characters were deleted.
 */
export function updateRealFromMasked(display: string, prevReal: string): string {
  const added = display
    .split('')
    .filter((c) => c !== MASK)
    .join('')
  const deleted = prevReal.length + added.length - display.length
  return prevReal.slice(0, Math.max(0, prevReal.length - deleted)) + added
}

export { MASK as FORM_MASK }
