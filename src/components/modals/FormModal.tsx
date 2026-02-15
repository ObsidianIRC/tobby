import { useState } from 'react'
import { useKeyboard } from '@opentui/react'
import { ModalShell } from './ModalShell'
import { THEME } from '../../constants/theme'

export interface FormField {
  key: string
  label: string
  placeholder?: string
  defaultValue?: string
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
      initial[field.key] = field.defaultValue ?? ''
    }
    return initial
  })
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
      onSubmit(values)
    }
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
            <input
              value={values[field.key] ?? ''}
              onInput={(v: string) => setValues((prev) => ({ ...prev, [field.key]: v }))}
              onSubmit={handleFieldSubmit}
              focused={focusedField === index}
              placeholder={field.placeholder}
              width={modalWidth - 6}
              backgroundColor={THEME.backgroundInput}
              focusedBackgroundColor={THEME.backgroundHighlight}
            />
          </box>
        ))}
      </scrollbox>
    </ModalShell>
  )
}
