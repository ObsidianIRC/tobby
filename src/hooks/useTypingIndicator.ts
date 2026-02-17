import { useEffect, useRef } from 'react'
import { useAppContext } from '../context/AppContext'
import { useStore } from '../store'

interface UseTypingIndicatorOptions {
  input: string
  debounceMs?: number
}

export function useTypingIndicator({ input, debounceMs = 3000 }: UseTypingIndicatorOptions) {
  const { registry, ircClient, renderer } = useAppContext()
  const store = useStore()
  const timeoutRef = useRef<Timer | null>(null)
  const isActiveRef = useRef(false)

  useEffect(() => {
    if (!ircClient) return

    const currentServer = store.servers.find((s) => s.id === store.currentServerId)
    const currentChannel = currentServer?.channels.find((c) => c.id === store.currentChannelId)

    if (!currentServer || !currentChannel) return

    // Only send typing notifications for regular messages, not commands
    const isTyping = input.length > 0 && !input.startsWith('/')

    const context = { store, ircClient, currentServer, currentChannel, renderer }

    if (isTyping) {
      if (!isActiveRef.current) {
        isActiveRef.current = true
        registry.execute('message.typing', context, true)
      }
      // Reset the debounce timer on every keystroke
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        isActiveRef.current = false
        registry.execute('message.typing', context, false)
      }, debounceMs)
    } else if (isActiveRef.current) {
      // Input was cleared — send done immediately
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      isActiveRef.current = false
      registry.execute('message.typing', context, false)
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [input, ircClient, store, registry, renderer, debounceMs])
}
