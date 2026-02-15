import { useEffect, useRef } from 'react'
import { useAppContext } from '../context/AppContext'
import { useStore } from '../store'

interface UseTypingIndicatorOptions {
  isTyping: boolean
  debounceMs?: number
}

export function useTypingIndicator({ isTyping, debounceMs = 3000 }: UseTypingIndicatorOptions) {
  const { registry, ircClient, renderer } = useAppContext()
  const store = useStore()
  const timeoutRef = useRef<Timer | null>(null)
  const isActiveRef = useRef(false)

  useEffect(() => {
    if (!ircClient) return

    const currentServer = store.servers.find((s) => s.id === store.currentServerId)
    const currentChannel = currentServer?.channels.find((c) => c.id === store.currentChannelId)

    if (!currentServer || !currentChannel) return

    if (isTyping && !isActiveRef.current) {
      isActiveRef.current = true

      const context = {
        store,
        ircClient,
        currentServer,
        currentChannel,
        renderer,
      }

      registry.execute('message.typing', context, true)

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        isActiveRef.current = false
        registry.execute('message.typing', context, false)
      }, debounceMs)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isTyping, ircClient, store, registry, renderer, debounceMs])
}
