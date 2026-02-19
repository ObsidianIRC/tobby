import { useState, useRef } from 'react'
import { useKeyboard } from '@opentui/react'
import type { InputRenderable } from '@opentui/core'
import { ModalShell } from './ModalShell'
import { THEME } from '../../constants/theme'
import { updateRealFromMasked, FORM_MASK } from '../../utils/formMasking'

export interface FormField {
  key: string
  label: string
  placeholder?: string
  defaultValue?: string
  secret?: boolean
}

interface FormModalProps {
  width: number
  height: number
  title: string
  fields: FormField[]
  onSubmit: (values: Record<string, string>) => void
  onCancel: () => void
  submitLabel?: string
}

export function FormModal({
  width,
  height,
  title,
  fields,
  onSubmit,
  onCancel,
  submitLabel = 'Submit',
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
  const [focusedField, setFocusedField] = useState(0)

  const modalWidth = Math.min(55, width - 4)
  const modalHeight = Math.min(4 + fields.length * 3 + 2, height - 4)

  useKeyboard((key) => {
    if (key.name === 'escape') {
      onCancel()
      return
    }

    if (key.name === 'tab') {
      key.preventDefault()
      if (key.shift) {
        setFocusedField((prev) => (prev - 1 + fields.length) % fields.length)
      } else {
        setFocusedField((prev) => (prev + 1) % fields.length)
      }
      return
    }
  })

  const handleFieldSubmit = () => {
    if (focusedField < fields.length - 1) {
      setFocusedField((prev) => prev + 1)
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
      <scrollbox height={modalHeight - 4} paddingLeft={2} paddingRight={2} paddingTop={1}>
        {fields.map((field, index) => (
          <box key={field.key} flexDirection="column" marginBottom={1}>
            <text>
              <span fg={THEME.foreground}>{field.label}:</span>
            </text>
            {field.secret ? (
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
