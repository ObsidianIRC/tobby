import { useState, useMemo, useEffect, useRef } from 'react'
import { useKeyboard } from '@opentui/react'
import { useAppContext } from '../../context/AppContext'
import { useStore } from '../../store'
import { CommandParser } from '../../services/commands'
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
]

export function CommandInput({ width }: CommandInputProps) {
  const [input, setInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [errorMessage, setErrorMessage] = useState('')
  const [completionIndex, setCompletionIndex] = useState(-1)

  // Track whether a programmatic update is in progress to avoid
  // handleChange resetting completionIndex/historyIndex
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

  const getPrompt = () => {
    if (currentChannel) {
      return `[${currentChannel.name}] > `
    }
    if (currentPrivateChat) {
      return `[@${currentPrivateChat.username}] > `
    }
    if (currentServer) {
      return `[${currentServer.name}] > `
    }
    return '> '
  }

  const getCompletions = (text: string): string[] => {
    if (!text.startsWith('/')) return []
    const commandPart = text.slice(1).toLowerCase()
    if (!commandPart) return COMMANDS.map((cmd) => `/${cmd}`)
    return COMMANDS.filter((cmd) => cmd.startsWith(commandPart)).map((cmd) => `/${cmd}`)
  }

  const handleTabCompletion = () => {
    if (!input.startsWith('/')) return

    const matches = getCompletions(input)
    if (matches.length === 0) return

    programmaticUpdate.current = true
    if (completionIndex === -1) {
      setCompletionIndex(0)
      setInput(matches[0] + ' ')
    } else {
      const nextIndex = (completionIndex + 1) % matches.length
      setCompletionIndex(nextIndex)
      setInput(matches[nextIndex] + ' ')
    }
  }

  const handleSubmit = async (value: string) => {
    const text = value.trim()
    if (!text) return

    setErrorMessage('')
    setCompletionIndex(-1)

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

  // Intercept tab, up, down — prevent <input> from processing them
  useKeyboard((key) => {
    if (key.name === 'tab') {
      key.preventDefault()
      handleTabCompletion()
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
  })

  const handleInput = (value: string) => {
    if (programmaticUpdate.current) {
      programmaticUpdate.current = false
      return
    }
    setInput(value)
    setHistoryIndex(-1)
    setCompletionIndex(-1)
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
