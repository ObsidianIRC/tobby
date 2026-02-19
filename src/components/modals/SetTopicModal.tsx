import { useState, useEffect, useRef } from 'react'
import { useKeyboard } from '@opentui/react'
import { useStore } from '../../store'
import { useAppContext } from '../../context/AppContext'
import { THEME } from '../../constants/theme'
import { ModalShell } from './ModalShell'

interface SetTopicModalProps {
  width: number
  height: number
}

export function SetTopicModal({ width, height }: SetTopicModalProps) {
  const closeModal = useStore((state) => state.closeModal)
  const setModalError = useStore((state) => state.setModalError)
  const modalError = useStore((state) => state.modalError)
  const currentServerId = useStore((state) => state.currentServerId)
  const currentChannelId = useStore((state) => state.currentChannelId)
  const servers = useStore((state) => state.servers)
  const { ircClient } = useAppContext()

  const currentServer = servers.find((s) => s.id === currentServerId)
  const currentChannel = currentServer?.channels.find((c) => c.id === currentChannelId)

  const [topic, setTopic] = useState(currentChannel?.topic ?? '')
  const closeTimerRef = useRef<Timer | null>(null)

  const handleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    setModalError(null)
    closeModal()
  }

  const handleSubmit = () => {
    if (!ircClient || !currentServer || !currentChannel) return
    setModalError(null)
    ircClient.setTopic(currentServer.id, currentChannel.name, topic)
    // Close after a short wait — if 482 arrives it will cancel this and show the error
    closeTimerRef.current = setTimeout(() => handleClose(), 1500)
  }

  // If 482 came back, cancel the auto-close and stay open
  useEffect(() => {
    if (modalError && closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [modalError])

  // Clean up timer on unmount
  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    },
    []
  )

  useKeyboard((key) => {
    if (key.name === 'escape') {
      handleClose()
      return
    }
  })

  const modalWidth = Math.min(60, width - 4)
  const hasError = !!modalError
  const modalHeight = 5 + (hasError ? 1 : 0)

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
        <span fg={THEME.accent}>Enter</span> Set topic
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
      title={`Set Topic — ${currentChannel?.name ?? ''}`}
      footer={footer}
    >
      <box paddingLeft={2} paddingRight={2} paddingTop={1} height={2}>
        <input
          focused
          value={topic}
          onInput={(v) => {
            setTopic(v)
            setModalError(null)
          }}
          onSubmit={handleSubmit}
          placeholder="Enter new topic..."
          flexGrow={1}
          backgroundColor={THEME.backgroundElement}
          focusedBackgroundColor={THEME.backgroundElement}
        />
      </box>
      {hasError && (
        <box paddingLeft={2} paddingRight={2} height={1}>
          <text fg={THEME.error}>⚠ {modalError}</text>
        </box>
      )}
    </ModalShell>
  )
}
