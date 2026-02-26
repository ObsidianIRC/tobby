import React, { useState, useRef, useEffect } from 'react'
import { useKeyboard } from '@opentui/react'
import type { InputRenderable, ScrollBoxRenderable } from '@opentui/core'
import { ModalShell } from './ModalShell'
import { THEME } from '../../constants/theme'
import { updateRealFromMasked, FORM_MASK } from '../../utils/formMasking'

export interface FormField {
  key: string
  label: string
  placeholder?: string
  defaultValue?: string
  secret?: boolean
  /** When true the field is displayed as fixed text and excluded from Tab/Enter navigation */
  readOnly?: boolean
}

interface FormModalProps {
  width: number
  height: number
  title: string
  fields: FormField[]
  onSubmit: (values: Record<string, string>) => void
  onCancel: () => void
  submitLabel?: string
  error?: string
}

const firstEditable = (fields: FormField[]) => {
  const idx = fields.findIndex((f) => !f.readOnly)
  return idx === -1 ? 0 : idx
}

const nextEditable = (fields: FormField[], from: number): number => {
  for (let i = from + 1; i < fields.length; i++) {
    if (!fields[i]!.readOnly) return i
  }
  return -1
}

const prevEditable = (fields: FormField[], from: number): number => {
  for (let i = from - 1; i >= 0; i--) {
    if (!fields[i]!.readOnly) return i
  }
  return -1
}

export function FormModal({
  width,
  height,
  title,
  fields,
  onSubmit,
  onCancel,
  submitLabel = 'Submit',
  error,
}: FormModalProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const field of fields) {
      if (!field.secret) initial[field.key] = field.defaultValue ?? ''
    }
    return initial
  })
  const [secretValues, setSecretValues] = useState<Record<string, string>>({})
  // Refs for secret <input> elements — allows setText() without re-triggering onInput
  const secretRefs = useRef<Map<string, InputRenderable>>(new Map())
  const [focusedField, setFocusedField] = useState(() => firstEditable(fields))
  const scrollBoxRef = useRef<ScrollBoxRenderable | null>(null)

  // Scroll the field into view when focus changes
  useEffect(() => {
    const box = scrollBoxRef.current
    if (!box) return
    // Each field: label (1) + input (1) + marginBottom (1) = 3 rows; paddingTop = 1
    const FIELD_HEIGHT = 3
    const PADDING_TOP = 1
    const fieldTop = PADDING_TOP + focusedField * FIELD_HEIGHT
    const fieldBottom = fieldTop + 2 // label + input
    const viewportHeight = box.height ?? 0
    if (fieldTop < box.scrollTop) {
      box.scrollTop = fieldTop
    } else if (fieldBottom >= box.scrollTop + viewportHeight) {
      box.scrollTop = fieldBottom - viewportHeight + 1
    }
  }, [focusedField])

  const modalWidth = Math.min(55, width - 4)
  const errorOffset = error ? 1 : 0
  const modalHeight = Math.min(4 + fields.length * 3 + 2 + errorOffset, height - 4)

  useKeyboard((key) => {
    if (key.name === 'escape') {
      onCancel()
      return
    }

    if (key.name === 'tab') {
      key.preventDefault()
      if (key.shift) {
        const prev = prevEditable(fields, focusedField)
        if (prev !== -1) setFocusedField(prev)
      } else {
        const next = nextEditable(fields, focusedField)
        if (next !== -1) setFocusedField(next)
      }
      return
    }
  })

  const handleFieldSubmit = () => {
    const next = nextEditable(fields, focusedField)
    if (next !== -1) {
      setFocusedField(next)
    } else {
      const merged = { ...values }
      for (const field of fields) {
        if (field.secret) merged[field.key] = secretValues[field.key] ?? ''
      }
      onSubmit(merged)
    }
  }

  const handleInput = (field: FormField, v: string) => {
    if (!field.secret) {
      setValues((prev) => ({ ...prev, [field.key]: v }))
      return
    }

    const prevReal = secretValues[field.key] ?? ''
    const newReal = updateRealFromMasked(v, prevReal)

    // Replace buffer with mask characters directly — setText does NOT fire onInput,
    // so there is no feedback loop. We also move the cursor to the end.
    const ref = secretRefs.current.get(field.key)
    if (ref) {
      ref.setText(FORM_MASK.repeat(newReal.length))
      ref.cursorOffset = newReal.length
    }

    setSecretValues((prev) => ({ ...prev, [field.key]: newReal }))
  }

  const footer = (
    <box flexDirection="column">
      {error && (
        <box height={1} paddingLeft={2} paddingRight={2} backgroundColor={THEME.backgroundElement}>
          <text fg={THEME.error}>⚠ {error}</text>
        </box>
      )}
      <box
        paddingLeft={2}
        paddingRight={2}
        height={1}
        backgroundColor={THEME.backgroundElement}
        justifyContent="space-between"
        flexDirection="row"
      >
        <text fg={THEME.mutedText}>
          <span fg={THEME.accent}>Tab</span> Next <span fg={THEME.accent}>Enter</span> {submitLabel}
        </text>
        <text fg={THEME.mutedText}>
          <span fg={THEME.accent}>Esc</span> Cancel
        </text>
      </box>
    </box>
  )

  return (
    <ModalShell
      width={width}
      height={height}
      modalWidth={modalWidth}
      modalHeight={modalHeight}
      title={title}
      footer={footer}
    >
      <scrollbox
        ref={scrollBoxRef as React.RefObject<ScrollBoxRenderable>}
        height={modalHeight - 4 - errorOffset}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
      >
        {fields.map((field, index) => (
          <box key={field.key} flexDirection="column" marginBottom={1}>
            <text>
              <span fg={field.readOnly ? THEME.dimText : THEME.foreground}>{field.label}:</span>
            </text>
            {field.readOnly ? (
              <box width={modalWidth - 6} height={1} backgroundColor={THEME.backgroundElement}>
                <text fg={THEME.mutedText}>{values[field.key]}</text>
              </box>
            ) : field.secret ? (
              <input
                ref={(el: InputRenderable | null) => {
                  if (el) secretRefs.current.set(field.key, el)
                  else secretRefs.current.delete(field.key)
                }}
                onInput={(v: string) => handleInput(field, v)}
                onSubmit={handleFieldSubmit}
                focused={focusedField === index}
                placeholder={field.placeholder}
                width={modalWidth - 6}
                backgroundColor={THEME.backgroundInput}
                focusedBackgroundColor={THEME.backgroundHighlight}
              />
            ) : (
              <input
                value={values[field.key] ?? ''}
                onInput={(v: string) => handleInput(field, v)}
                onSubmit={handleFieldSubmit}
                focused={focusedField === index}
                placeholder={field.placeholder}
                width={modalWidth - 6}
                backgroundColor={THEME.backgroundInput}
                focusedBackgroundColor={THEME.backgroundHighlight}
              />
            )}
          </box>
        ))}
      </scrollbox>
    </ModalShell>
  )
}
