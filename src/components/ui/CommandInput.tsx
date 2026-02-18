import { useState, useMemo, useEffect, useRef } from 'react'
import { useKeyboard } from '@opentui/react'
import type { TextareaRenderable } from '@opentui/core'
import { useAppContext } from '../../context/AppContext'
import { useStore } from '../../store'
import { CommandParser } from '../../services/commands'
import { useTypingIndicator } from '../../hooks/useTypingIndicator'
import { useTabCompletion } from '../../hooks/useTabCompletion'
import { copyToClipboard } from '../../utils/clipboard'
import { stripIrcFormatting } from '../../utils/ircFormatting'
import { THEME, COLORS } from '../../constants/theme'
import type { Message } from '../../types'

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

const SELECTABLE_TYPES: Message['type'][] = ['message', 'action']

export function CommandInput({ width }: CommandInputProps) {
  const textareaRef = useRef<TextareaRenderable | null>(null)
  const [inputLineCount, setInputLineCount] = useState(1)
  // Tracks textarea text for typing indicator (read from ref on content change)
  const [inputText, setInputText] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [errorMessage, setErrorMessage] = useState('')

  const getText = () => textareaRef.current?.plainText ?? ''
  const clearText = () => {
    textareaRef.current?.setText('')
    setInputLineCount(1)
    setInputText('')
    useStore.getState().setInputLineCount(1)
  }
  const loadText = (t: string) => textareaRef.current?.setText(t)

  const { registry, ircClient, renderer } = useAppContext()
  const activeModal = useStore((state) => state.activeModal)
  const currentServerId = useStore((state) => state.currentServerId)
  const currentChannelId = useStore((state) => state.currentChannelId)
  const servers = useStore((state) => state.servers)
  const messages = useStore((state) => state.messages)
  const selectedMessage = useStore((state) => state.selectedMessage)
  const setSelectedMessage = useStore((state) => state.setSelectedMessage)
  const replyingTo = useStore((state) => state.replyingTo)
  const setReplyingTo = useStore((state) => state.setReplyingTo)
  const openModal = useStore((state) => state.openModal)
  const quitWarning = useStore((state) => state.quitWarning)

  const currentServer = servers.find((s) => s.id === currentServerId)
  const currentChannel = currentServer?.channels.find((c) => c.id === currentChannelId)
  const currentPrivateChat = currentServer?.privateChats.find((pc) => pc.id === currentChannelId)

  const commandParser = useMemo(() => new CommandParser(registry), [registry])

  useTypingIndicator({ input: inputText })

  const { handleTabCompletion, resetCompletion } = useTabCompletion()

  const selectableMessages = useMemo(() => {
    const msgs = currentChannelId ? (messages.get(currentChannelId) ?? []) : []
    return msgs.filter((m) => SELECTABLE_TYPES.includes(m.type))
  }, [messages, currentChannelId])

  const getPrompt = () => {
    if (currentChannel) return `[${currentChannel.name}] > `
    if (currentPrivateChat) return `[@${currentPrivateChat.username}] > `
    if (currentServer) return `[${currentServer.name}] > `
    return '> '
  }

  const handleSubmit = async (rawText: string) => {
    const text = rawText.trim()
    if (!text) return

    setErrorMessage('')
    resetCompletion()

    const isCommand = text.startsWith('/')
    const hasNewlines = text.includes('\n')

    if (!isCommand && hasNewlines && currentServer) {
      const lines = text.split('\n').filter(Boolean)
      const target = currentChannel?.name ?? currentPrivateChat?.username
      const supportsMultiline = currentServer.capabilities?.includes('draft/multiline') ?? false

      if (target) {
        if (supportsMultiline) {
          const batchId = `ml_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
          const replyPrefix = replyingTo?.msgid ? `@+draft/reply=${replyingTo.msgid} ` : ''
          ircClient!.sendRaw(
            currentServer.id,
            `${replyPrefix}BATCH +${batchId} draft/multiline ${target}`
          )
          for (const line of lines) {
            ircClient!.sendRaw(currentServer.id, `@batch=${batchId} PRIVMSG ${target} :${line}`)
          }
          ircClient!.sendRaw(currentServer.id, `BATCH -${batchId}`)

          const hasEcho = currentServer.capabilities?.includes('echo-message') ?? false
          if (!hasEcho) {
            const chId = currentChannel?.id ?? currentPrivateChat?.id ?? currentChannelId!
            useStore.getState().addMessage(chId, {
              id: crypto.randomUUID(),
              type: 'message',
              content: lines.join('\n'),
              isMultiline: true,
              lines,
              timestamp: new Date(),
              userId: currentServer.nickname,
              channelId: chId,
              serverId: currentServer.id,
              reactions: [],
              replyMessage: replyingTo ?? null,
              mentioned: [],
            })
          }
        } else {
          // Fallback: send each line as a separate PRIVMSG
          const ctx = {
            store: useStore.getState(),
            ircClient: ircClient!,
            currentServer,
            currentChannel,
            renderer,
          }
          for (const line of lines) {
            await commandParser.parse(line, ctx)
          }
        }
      }

      clearText()
      setCommandHistory((prev) => [...prev, text])
      setHistoryIndex(-1)
      setReplyingTo(null)
      setSelectedMessage(null)
      return
    }

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
      clearText()
      setReplyingTo(null)
      setSelectedMessage(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Command failed')
    }
  }

  useKeyboard((key) => {
    // Enter submits; Shift+Enter inserts newline (kitty terminals) or use Ctrl+Enter on others
    if (key.name === 'return' && !activeModal && !selectedMessage) {
      if (key.shift || key.ctrl) {
        key.preventDefault()
        textareaRef.current?.newLine()
        return
      }
      key.preventDefault()
      handleSubmit(getText())
      return
    }

    // Ctrl+Space toggles selection mode
    if (key.ctrl && key.name === 'space' && !activeModal) {
      if (selectedMessage) {
        setSelectedMessage(null)
        return
      }
      const last = selectableMessages[selectableMessages.length - 1]
      if (last) {
        setSelectedMessage(last)
        return
      }
    }

    if (selectedMessage && !activeModal) {
      const idx = selectableMessages.findIndex((m) => m.id === selectedMessage.id)

      if (key.name === 'k' || key.name === 'up') {
        key.preventDefault()
        const prev = selectableMessages[idx - 1]
        if (prev) setSelectedMessage(prev)
        return
      }

      if (key.name === 'j' || key.name === 'down') {
        key.preventDefault()
        const next = selectableMessages[idx + 1]
        setSelectedMessage(next ?? null)
        return
      }

      if (key.ctrl && key.name === 'u') {
        key.preventDefault()
        const target = selectableMessages[Math.max(0, idx - 10)]
        if (target) setSelectedMessage(target)
        return
      }

      if (key.ctrl && key.name === 'd') {
        key.preventDefault()
        const target = selectableMessages[Math.min(selectableMessages.length - 1, idx + 10)]
        if (target) setSelectedMessage(target)
        return
      }

      if (key.name === 'escape') {
        setSelectedMessage(null)
        return
      }

      if (key.name === 'r') {
        setReplyingTo(selectedMessage)
        setSelectedMessage(null)
        return
      }

      if (key.name === 'e') {
        openModal('emojiPicker')
        return
      }

      if (key.name === 'y') {
        copyToClipboard(stripIrcFormatting(selectedMessage.content))
        setSelectedMessage(null)
        return
      }

      return
    }

    if (key.name === 'tab') {
      key.preventDefault()
      const users = currentChannel?.users ?? []
      const channels = currentServer?.channels ?? []
      const result = handleTabCompletion(getText(), { users, channels, commands: COMMANDS })
      if (result) {
        loadText(result.newText)
        if (textareaRef.current) {
          textareaRef.current.cursorOffset = result.newCursorPosition
        }
      }
      return
    }

    // History navigation only when textarea is single-line
    if (key.name === 'up' && inputLineCount === 1) {
      key.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex =
          historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        const historyItem = commandHistory[newIndex]
        if (historyItem !== undefined) {
          loadText(historyItem)
        }
      }
      return
    }

    if (key.name === 'down' && inputLineCount === 1) {
      key.preventDefault()
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1)
          clearText()
        } else {
          setHistoryIndex(newIndex)
          const historyItem = commandHistory[newIndex]
          if (historyItem !== undefined) {
            loadText(historyItem)
          }
        }
      }
      return
    }

    if (key.ctrl && key.name === 'u' && !selectedMessage) {
      clearText()
      setHistoryIndex(-1)
      resetCompletion()
      return
    }
  })

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [errorMessage])

  const prompt = getPrompt()
  const promptWidth = prompt.length
  const visibleLines = Math.min(inputLineCount, 5)

  return (
    <box
      width={width}
      height={1 + visibleLines + (errorMessage ? 1 : 0) + (quitWarning ? 1 : 0)}
      flexDirection="column"
    >
      <box
        height={visibleLines}
        paddingLeft={1}
        backgroundColor={THEME.backgroundInput}
        flexDirection="row"
      >
        <box width={promptWidth} flexShrink={0} height={1}>
          <text>
            <span fg={THEME.accentBlue}>{prompt}</span>
          </text>
        </box>
        <textarea
          ref={textareaRef as React.RefObject<TextareaRenderable>}
          height={visibleLines}
          focused={!activeModal && !selectedMessage}
          backgroundColor={THEME.backgroundInput}
          focusedBackgroundColor={THEME.backgroundInput}
          placeholder="Type a message or /command..."
          flexGrow={1}
          onContentChange={() => {
            const lc = textareaRef.current?.lineCount ?? 1
            const txt = getText()
            setInputLineCount(lc)
            setInputText(txt)
            useStore.getState().setInputLineCount(lc)
          }}
        />
      </box>
      {errorMessage && (
        <box height={1} paddingLeft={1} backgroundColor={THEME.backgroundInput}>
          <text>
            <span fg={THEME.error}>⚠ {errorMessage}</span>
          </text>
        </box>
      )}
      {quitWarning && (
        <box height={1} paddingLeft={1} backgroundColor={THEME.backgroundInput}>
          <text>
            <span fg={COLORS.orange}>{quitWarning}</span>
          </text>
        </box>
      )}
    </box>
  )
}
