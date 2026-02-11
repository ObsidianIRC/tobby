import { useState, useEffect, useMemo } from 'react'
import { useKeyboard } from '@opentui/react'
import { useAppContext } from '../../context/AppContext'
import { useStore } from '../../store'
import { CommandParser } from '../../services/commands'
import { handleEmacsKeybindings } from '../../hooks/useEmacsKeybindings'
import { THEME } from '../../constants/theme'

interface CommandInputProps {
  width: number
}

const COMMANDS = ['connect', 'join', 'part', 'msg', 'me', 'topic', 'nick', 'quit', 'whois', 'away']

export function CommandInput({ width }: CommandInputProps) {
  const [input, setInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [errorMessage, setErrorMessage] = useState('')
  const [completionIndex, setCompletionIndex] = useState(-1)

  const { registry, ircClient, renderer } = useAppContext()
  const currentServerId = useStore((state) => state.currentServerId)
  const currentChannelId = useStore((state) => state.currentChannelId)
  const servers = useStore((state) => state.servers)

  const currentServer = servers.find((s) => s.id === currentServerId)
  const currentChannel = currentServer?.channels.find((c) => c.id === currentChannelId)

  const commandParser = useMemo(() => new CommandParser(registry), [registry])

  const getPrompt = () => {
    if (currentChannel) {
      return `[${currentChannel.name}] > `
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
    if (input.startsWith('/')) {
      const matches = getCompletions(input)

      if (matches.length === 0) return

      if (completionIndex === -1) {
        setCompletionIndex(0)
        setInput(matches[0] + ' ')
      } else {
        const nextIndex = (completionIndex + 1) % matches.length
        setCompletionIndex(nextIndex)
        setInput(matches[nextIndex] + ' ')
      }
    }
  }

  const handleSubmit = async () => {
    if (!input.trim()) return

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
      const result = await commandParser.parse(input, context)

      if (!result.success) {
        setErrorMessage(result.message || 'Command failed')
        setTimeout(() => setErrorMessage(''), 3000)
        return
      }

      setCommandHistory((prev) => [...prev, input])
      setHistoryIndex(-1)
      setInput('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Command failed')
      setTimeout(() => setErrorMessage(''), 3000)
    }
  }

  useKeyboard((key) => {
    const emacsHandled = handleEmacsKeybindings(key, {
      input,
      setInput,
    })

    if (emacsHandled) {
      setHistoryIndex(-1)
      setCompletionIndex(-1)
      return
    }

    if (key.name === 'return') {
      if (key.shift) {
        setInput((prev) => prev + '\n')
      } else {
        handleSubmit()
      }
    } else if (key.name === 'tab') {
      handleTabCompletion()
    } else if (key.name === 'up') {
      if (commandHistory.length > 0) {
        const newIndex =
          historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        const historyItem = commandHistory[newIndex]
        if (historyItem !== undefined) {
          setInput(historyItem)
        }
      }
    } else if (key.name === 'down') {
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1
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
    } else if (key.name === 'backspace') {
      setInput((prev) => prev.slice(0, -1))
      setHistoryIndex(-1)
      setCompletionIndex(-1)
    } else if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
      setInput((prev) => prev + key.sequence)
      setHistoryIndex(-1)
      setCompletionIndex(-1)
    }
  })

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [errorMessage])

  return (
    <box width={width} height={errorMessage ? 4 : 3} flexDirection="column">
      <box
        height={2}
        border={['top']}
        borderStyle="single"
        borderColor={THEME.border}
        paddingLeft={1}
        backgroundColor={THEME.backgroundPanel}
      >
        <text>
          <span fg={THEME.accent}>{getPrompt()}</span>
          <span fg={THEME.foreground}>{input}</span>
          <span fg={THEME.accent}>█</span>
        </text>
      </box>
      {errorMessage && (
        <box height={1} paddingLeft={1} backgroundColor={THEME.backgroundPanel}>
          <text fg={THEME.error}>{errorMessage}</text>
        </box>
      )}
    </box>
  )
}
