import { useState, useEffect, useMemo, useRef } from 'react'
import { useKeyboard } from '@opentui/react'
import Fuse from 'fuse.js'
import { useStore } from '../../store'
import { useAppContext } from '../../context/AppContext'
import { THEME } from '../../constants/theme'
import { ModalShell } from './ModalShell'

interface ChannelEntry {
  channel: string
  userCount: number
  topic: string
}

interface ChannelBrowserModalProps {
  width: number
  height: number
}

export function ChannelBrowserModal({ width, height }: ChannelBrowserModalProps) {
  const closeModal = useStore((state) => state.closeModal)
  const currentServerId = useStore((state) => state.currentServerId)
  const servers = useStore((state) => state.servers)
  const setCurrentServer = useStore((state) => state.setCurrentServer)
  const setCurrentChannel = useStore((state) => state.setCurrentChannel)
  const { ircClient, registry, renderer } = useAppContext()

  const currentServer = servers.find((s) => s.id === currentServerId)

  const [channels, setChannels] = useState<ChannelEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const programmaticUpdate = useRef(false)

  const modalWidth = Math.min(72, width - 4)
  const modalHeight = Math.min(24, height - 4)
  const listHeight = modalHeight - 4 // border(2) + input(1) + footer(1)

  // Request channel list on mount — accumulate in a ref, flush on LIST_END to avoid
  // thousands of individual state updates (one per channel) which would freeze the UI
  const bufferRef = useRef<ChannelEntry[]>([])

  useEffect(() => {
    if (!ircClient || !currentServerId) return

    bufferRef.current = []

    const handleChannel = (data: {
      serverId: string
      channel: string
      userCount: number
      topic: string
    }) => {
      if (data.serverId !== currentServerId) return
      bufferRef.current.push({
        channel: data.channel,
        userCount: data.userCount,
        topic: data.topic,
      })
    }

    const handleEnd = (data: { serverId: string }) => {
      if (data.serverId !== currentServerId) return
      setChannels(bufferRef.current.slice())
      setLoading(false)
    }

    ircClient.on('LIST_CHANNEL', handleChannel)
    ircClient.on('LIST_END', handleEnd)
    ircClient.listChannels(currentServerId)

    return () => {
      ircClient.deleteHook('LIST_CHANNEL', handleChannel)
      ircClient.deleteHook('LIST_END', handleEnd)
    }
  }, [ircClient, currentServerId])

  const fuse = useMemo(
    () => new Fuse(channels, { keys: ['channel', 'topic'], threshold: 0.35 }),
    [channels]
  )

  const filtered = useMemo(() => {
    if (!query) return [...channels].sort((a, b) => b.userCount - a.userCount)
    return fuse.search(query).map((r) => r.item)
  }, [query, channels, fuse])

  const visibleItems = filtered.slice(0, listHeight - 1)

  const handleSelect = (entry: ChannelEntry) => {
    if (!currentServer || !ircClient) return
    const existing = currentServer.channels.find(
      (c) => c.name.toLowerCase() === entry.channel.toLowerCase()
    )
    if (existing) {
      setCurrentServer(currentServer.id)
      setCurrentChannel(existing.id)
    } else {
      const store = useStore.getState()
      registry.execute(
        'channel.join',
        {
          store,
          ircClient,
          currentServer,
          renderer,
        },
        entry.channel
      )
    }
    closeModal()
  }

  useKeyboard((key) => {
    if (key.name === 'escape') {
      closeModal()
      return
    }
    if (key.name === 'up') {
      key.preventDefault()
      setSelectedIndex((prev) => Math.max(0, prev - 1))
      return
    }
    if (key.name === 'down' || key.name === 'tab') {
      key.preventDefault()
      setSelectedIndex((prev) => Math.min(visibleItems.length - 1, prev + 1))
      return
    }
  })

  const handleQueryInput = (value: string) => {
    if (programmaticUpdate.current) {
      programmaticUpdate.current = false
      return
    }
    setQuery(value)
    setSelectedIndex(0)
  }

  const handleQuerySubmit = () => {
    const entry = visibleItems[selectedIndex]
    if (entry) handleSelect(entry)
  }

  const totalCount = channels.length
  const statusText = loading ? `Loading… (${totalCount} so far)` : `${totalCount} channels`

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
        <span fg={THEME.accent}>↑↓</span> Navigate <span fg={THEME.accent}>Enter</span> Join/Switch
      </text>
      <text fg={THEME.mutedText}>
        {statusText}
        {'  '}
        <span fg={THEME.accent}>Esc</span> Close
      </text>
    </box>
  )

  return (
    <ModalShell
      width={width}
      height={height}
      modalWidth={modalWidth}
      modalHeight={modalHeight}
      title={`Channels — ${currentServer?.name ?? ''}`}
      footer={footer}
    >
      <box paddingLeft={2} paddingRight={2} height={1} backgroundColor={THEME.backgroundElement}>
        <input
          focused
          value={query}
          onInput={handleQueryInput}
          onSubmit={handleQuerySubmit}
          placeholder="Search channels…"
          flexGrow={1}
          backgroundColor={THEME.backgroundElement}
          focusedBackgroundColor={THEME.backgroundElement}
        />
      </box>

      <scrollbox height={listHeight}>
        {visibleItems.length === 0 ? (
          <box paddingLeft={2} paddingTop={1}>
            <text fg={THEME.mutedText}>{loading ? 'Fetching channel list…' : 'No results'}</text>
          </box>
        ) : (
          visibleItems.map((entry, index) => {
            const isSelected = index === selectedIndex
            const alreadyIn = currentServer?.channels.some(
              (c) => c.name.toLowerCase() === entry.channel.toLowerCase()
            )
            const topicPreview =
              entry.topic.length > 30 ? entry.topic.slice(0, 30) + '…' : entry.topic

            return (
              <box
                key={entry.channel}
                paddingLeft={2}
                paddingRight={2}
                backgroundColor={isSelected ? THEME.selectedBackground : undefined}
                flexDirection="row"
                justifyContent="space-between"
              >
                <text>
                  <span
                    fg={
                      isSelected ? THEME.accent : alreadyIn ? THEME.accentGreen : THEME.foreground
                    }
                  >
                    {entry.channel}
                  </span>
                  {topicPreview ? <span fg={THEME.mutedText}> {topicPreview}</span> : null}
                </text>
                <text fg={THEME.dimText}>{entry.userCount}</text>
              </box>
            )
          })
        )}
      </scrollbox>
    </ModalShell>
  )
}
