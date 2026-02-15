import type { ReactNode } from 'react'
import { THEME } from '../../constants/theme'

interface ModalShellProps {
  width: number
  height: number
  modalWidth?: number
  modalHeight?: number
  title?: string
  footer?: ReactNode
  children: ReactNode
}

export function ModalShell({
  width,
  height,
  modalWidth,
  modalHeight,
  title,
  footer,
  children,
}: ModalShellProps) {
  const mw = modalWidth ?? Math.min(60, width - 4)
  const mh = modalHeight ?? Math.min(20, height - 4)
  const mx = Math.floor((width - mw) / 2)
  const my = Math.floor((height - mh) / 2)

  return (
    <box
      position="absolute"
      left={mx}
      top={my}
      width={mw}
      height={mh}
      border
      borderStyle="single"
      borderColor={THEME.borderActive}
      backgroundColor={THEME.backgroundPanel}
      flexDirection="column"
      title={title}
      titleAlignment="center"
    >
      {children}

      {footer !== undefined ? (
        footer
      ) : (
        <box
          paddingLeft={2}
          paddingRight={2}
          height={1}
          backgroundColor={THEME.backgroundElement}
          justifyContent="flex-end"
          flexDirection="row"
        >
          <text fg={THEME.mutedText}>
            <span fg={THEME.accent}>Esc</span> Close
          </text>
        </box>
      )}
    </box>
  )
}
