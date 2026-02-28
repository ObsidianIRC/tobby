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
import { registerInputRef, focusInput } from '../../utils/inputFocus'
import { THEME, COLORS } from '../../constants/theme'
import type { Message } from '../../types'

interface CommandInputProps {
  width: number
}

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
  const loadText = (t: string) => {
    textareaRef.current?.setText(t)
    if (textareaRef.current) textareaRef.current.cursorOffset = t.length
  }

  const { registry, ircClient, renderer } = useAppContext()
  const activeModal = useStore((state) => state.activeModal)
  const toggleExpandMultilines = useStore((state) => state.toggleExpandMultilines)
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
  const messageSearch = useStore((state) => state.messageSearch)
  const setMessageSearch = useStore((state) => state.setMessageSearch)

  const currentServer = servers.find((s) => s.id === currentServerId)
  const currentChannel = currentServer?.channels.find((c) => c.id === currentChannelId)
  const currentPrivateChat = currentServer?.privateChats.find((pc) => pc.id === currentChannelId)

  const commandParser = useMemo(() => new CommandParser(registry), [registry])

  useEffect(() => {
    registerInputRef(textareaRef.current)
    return () => registerInputRef(null)
  }, [])

  useTypingIndicator({ input: inputText })

  const { handleTabCompletion, resetCompletion } = useTabCompletion()

  const channelMessages = useMemo(
    () => (currentChannelId ? (messages.get(currentChannelId) ?? []) : []),
    [messages, currentChannelId]
  )

  const selectableMessages = useMemo(
    () => channelMessages.filter((m) => SELECTABLE_TYPES.includes(m.type)),
    [channelMessages]
  )

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

    // A leading space before / escapes command processing (matches parse() behaviour)
    const isCommand = text.startsWith('/') && !rawText.startsWith(' ')
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
      // Pass rawText so parse() can detect the leading-space escape
      const result = await commandParser.parse(rawText, context)

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

    // Ctrl+Space / Alt+Up / Shift+Up / Alt+K toggles selection mode; also closes search if open
    // key.name is 'space' via legacy/tmux (NUL byte) or ' ' via Kitty keyboard protocol (\x1b[32;5u)
    const isToggleSelection =
      (key.ctrl && (key.name === 'space' || key.name === ' ')) ||
      ((key.meta || key.option) && key.name === 'up') ||
      (key.shift && key.name === 'up') ||
      ((key.meta || key.option) && key.name === 'k')
    if (isToggleSelection && !activeModal) {
      if (messageSearch !== null) {
        setMessageSearch(null)
        setSelectedMessage(null)
        return
      }
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

    // Search mode: Esc always exits. Enter unfocuses the input (typing → false).
    // n/p/shortcuts only work when input is not focused (!typing).
    // When typing, all other keys fall through to SearchBar's focused <input>.
    if (messageSearch !== null && !activeModal) {
      if (key.name === 'escape') {
        key.preventDefault()
        setMessageSearch(null)
        setSelectedMessage(null)
        return
      }
      if (key.name === 'return' && messageSearch.typing) {
        key.preventDefault()
        setMessageSearch({ ...messageSearch, typing: false })
        return
      }
      if (!messageSearch.typing) {
        if (key.name === '/') {
          key.preventDefault()
          setMessageSearch({ ...messageSearch, typing: true })
          return
        }
        if (key.name === 'p') {
          key.preventDefault()
          const older = messageSearch.currentIndex + 1
          if (older < messageSearch.matchIds.length) {
            const msg = channelMessages.find((m) => m.id === messageSearch.matchIds[older])
            if (msg) {
              setMessageSearch({ ...messageSearch, currentIndex: older })
              setSelectedMessage(msg)
            }
          }
          return
        }
        if (key.name === 'n') {
          key.preventDefault()
          const newer = messageSearch.currentIndex - 1
          if (newer >= 0) {
            const msg = channelMessages.find((m) => m.id === messageSearch.matchIds[newer])
            if (msg) {
              setMessageSearch({ ...messageSearch, currentIndex: newer })
              setSelectedMessage(msg)
            }
          }
          return
        }
        // Other keys when not typing fall through to the selection block (r/y/e/j/k etc.)
      }
      // When typing, all remaining keys fall through to SearchBar's focused <input>
    }

    // Selection block fires when: no search, OR search exists but input is not focused
    if (selectedMessage && !activeModal && !messageSearch?.typing) {
      if (key.name === '/' && !messageSearch) {
        key.preventDefault()
        setMessageSearch({ query: '', matchIds: [], currentIndex: 0, typing: true })
        return
      }

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
        key.preventDefault()
        setReplyingTo(selectedMessage)
        setSelectedMessage(null)
        focusInput()
        return
      }

      if (key.name === 'e') {
        key.preventDefault()
        openModal('emojiPicker')
        return
      }

      if (key.name === 'y') {
        key.preventDefault()
        copyToClipboard(stripIrcFormatting(selectedMessage.content))
        setSelectedMessage(null)
        return
      }

      if (key.name === 'g') {
        key.preventDefault()
        if (key.shift) {
          const last = selectableMessages[selectableMessages.length - 1]
          if (last) setSelectedMessage(last)
        } else {
          const first = selectableMessages[0]
          if (first) setSelectedMessage(first)
        }
        return
      }

      if (key.name === 'return' && selectedMessage.replyMessage) {
        key.preventDefault()
        const replyTarget = selectedMessage.replyMessage
        const channelMsgs = currentChannelId ? (messages.get(currentChannelId) ?? []) : []
        const target =
          channelMsgs.find((m) => m.id === replyTarget.id) ??
          channelMsgs.find((m) => m.msgid && m.msgid === replyTarget.msgid)
        if (target) setSelectedMessage(target)
        return
      }

      return
    }

    if (key.name === 'tab') {
      key.preventDefault()
      const users = currentChannel?.users ?? []
      const channels = currentServer?.channels ?? []
      const result = handleTabCompletion(getText(), {
        users,
        channels,
        commands: commandParser.getCommandNames(),
      })
      if (result) {
        loadText(result.newText)
        // setText doesn't fire onContentChange, so manually trigger a React re-render
        // so opentui flushes the terminal update on this keypress instead of the next one
        setInputText(result.newText)
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

    if (key.ctrl && key.name === 'o' && !activeModal) {
      toggleExpandMultilines()
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
  // 2 outer padding each side + 2 border chars + 1 inner paddingLeft = 7 fixed overhead
  const textareaWidth = Math.max(10, width - 7 - promptWidth)
  const visibleLines = Math.min(inputLineCount, 5)
  const isFocused = !activeModal && !selectedMessage && !messageSearch

  return (
    <box
      width={width}
      height={visibleLines + 2 + (errorMessage ? 1 : 0) + (quitWarning ? 1 : 0)}
      flexDirection="column"
      backgroundColor={THEME.backgroundInput}
      paddingLeft={2}
      paddingRight={2}
    >
      <box
        height={visibleLines + 2}
        border
        borderStyle="single"
        borderColor={isFocused ? THEME.borderFocus : THEME.border}
        backgroundColor={THEME.backgroundElement}
        flexDirection="row"
        paddingLeft={1}
        onMouseDown={selectedMessage ? () => setSelectedMessage(null) : undefined}
      >
        <box width={promptWidth} flexShrink={0} height={1}>
          <text>
            <span fg={THEME.accentBlue}>{prompt}</span>
          </text>
        </box>
        <textarea
          ref={textareaRef as React.RefObject<TextareaRenderable>}
          width={textareaWidth}
          height={visibleLines}
          focused={isFocused}
          backgroundColor={THEME.backgroundElement}
          focusedBackgroundColor={THEME.backgroundElement}
          placeholder="Type a message or /command..."
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
