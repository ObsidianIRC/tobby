import { useState, useMemo, useEffect, useRef } from 'react'
import { useKeyboard } from '@opentui/react'
import { useAppContext } from '../../context/AppContext'
import { useStore } from '../../store'
import { CommandParser } from '../../services/commands'
import { useTypingIndicator } from '../../hooks/useTypingIndicator'
import { useTabCompletion } from '../../hooks/useTabCompletion'
import { THEME } from '../../constants/theme'

interface CommandInputProps {
  width: number
}

const COMMANDS = [
  'help',
  'connect',
  'join',
  'part',
  'msg',
  'me',
  'topic',
  'nick',
  'quit',
  'whois',
  'away',
  'history',
  'whisper',
  'clear',
]

export function CommandInput({ width }: CommandInputProps) {
  const [input, setInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [errorMessage, setErrorMessage] = useState('')

  // Track whether a programmatic update is in progress to avoid
  // handleInput resetting history/completion state
  const programmaticUpdate = useRef(false)

  const { registry, ircClient, renderer } = useAppContext()
  const activeModal = useStore((state) => state.activeModal)
  const currentServerId = useStore((state) => state.currentServerId)
  const currentChannelId = useStore((state) => state.currentChannelId)
  const servers = useStore((state) => state.servers)

  const currentServer = servers.find((s) => s.id === currentServerId)
  const currentChannel = currentServer?.channels.find((c) => c.id === currentChannelId)
  const currentPrivateChat = currentServer?.privateChats.find((pc) => pc.id === currentChannelId)

  const commandParser = useMemo(() => new CommandParser(registry), [registry])

  useTypingIndicator({ input })

  const { handleTabCompletion, resetCompletion } = useTabCompletion()

  const getPrompt = () => {
    if (currentChannel) return `[${currentChannel.name}] > `
    if (currentPrivateChat) return `[@${currentPrivateChat.username}] > `
    if (currentServer) return `[${currentServer.name}] > `
    return '> '
  }

  const handleSubmit = async (value: string) => {
    const text = value.trim()
    if (!text) return

    setErrorMessage('')
    resetCompletion()

    const context = {
      store: useStore.getState(),
      ircClient: ircClient!,
      currentServer,
      currentChannel,
      renderer,
    }

    try {
      const result = await commandParser.parse(text, context)

      if (!result.success) {
        setErrorMessage(result.message || 'Command failed')
        return
      }

      setCommandHistory((prev) => [...prev, text])
      setHistoryIndex(-1)
      programmaticUpdate.current = true
      setInput('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Command failed')
    }
  }

  useKeyboard((key) => {
    if (key.name === 'tab') {
      key.preventDefault()

      const users = currentChannel?.users ?? []
      const channels = currentServer?.channels ?? []
      const result = handleTabCompletion(input, { users, channels, commands: COMMANDS })
      if (result) {
        programmaticUpdate.current = true
        setInput(result.newText)
      }
      return
    }

    if (key.name === 'up') {
      key.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex =
          historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        const historyItem = commandHistory[newIndex]
        if (historyItem !== undefined) {
          programmaticUpdate.current = true
          setInput(historyItem)
        }
      }
      return
    }

    if (key.name === 'down') {
      key.preventDefault()
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1
        programmaticUpdate.current = true
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1)
          setInput('')
        } else {
          setHistoryIndex(newIndex)
          const historyItem = commandHistory[newIndex]
          if (historyItem !== undefined) {
            setInput(historyItem)
          }
        }
      }
      return
    }

    // Ctrl+U clears the line in the terminal widget but may not fire onInput.
    // Explicitly sync React state so the typing indicator sends done.
    if (key.ctrl && key.name === 'u') {
      setInput('')
      setHistoryIndex(-1)
      resetCompletion()
      return
    }
  })

  const handleInput = (value: string) => {
    if (programmaticUpdate.current) {
      programmaticUpdate.current = false
      return
    }
    setInput(value)
    setHistoryIndex(-1)
    // Let the tab completion hook detect the text change itself; it will
    // reset its session on the next Tab press if the text diverged.
  }

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [errorMessage])

  const prompt = getPrompt()
  const promptWidth = prompt.length

  return (
    <box width={width} height={errorMessage ? 3 : 2} flexDirection="column">
      <box height={1} paddingLeft={1} backgroundColor={THEME.backgroundInput} flexDirection="row">
        <box width={promptWidth} flexShrink={0} height={1}>
          <text>
            <span fg={THEME.accentBlue}>{prompt}</span>
          </text>
        </box>
        <input
          focused={!activeModal}
          value={input}
          onInput={handleInput}
          onSubmit={
            ((value: string) => {
              handleSubmit(value)
            }) as any
          }
          placeholder="Type a message or /command..."
          flexGrow={1}
          backgroundColor={THEME.backgroundInput}
          focusedBackgroundColor={THEME.backgroundInput}
        />
      </box>
      {errorMessage && (
        <box height={1} paddingLeft={1} backgroundColor={THEME.backgroundInput}>
          <text>
            <span fg={THEME.error}>⚠ {errorMessage}</span>
          </text>
        </box>
      )}
    </box>
  )
}
