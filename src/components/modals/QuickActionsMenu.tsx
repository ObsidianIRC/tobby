import { useState, useMemo, useCallback, useRef } from 'react'
import { useKeyboard } from '@opentui/react'
import Fuse from 'fuse.js'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '../../store'
import { useAppContext } from '../../context/AppContext'
import { THEME } from '../../constants/theme'
import { ModalShell } from './ModalShell'
import type { Action } from '../../types'
import type { AppStore } from '../../store'

interface QuickActionsMenuProps {
  width: number
  height: number
}

interface QuickItem {
  id: string
  label: string
  sublabel?: string
  fg?: string
  kind: 'channel' | 'action' | 'join' | 'leave' | 'user'
  serverId?: string
  channelId?: string
  actionId?: string
  username?: string
}

export function QuickActionsMenu({ width, height }: QuickActionsMenuProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const programmaticUpdate = useRef(false)
  const { registry, ircClient, renderer } = useAppContext()
  const store = useStore()
  const closeModal = useStore((state) => state.closeModal)

  const currentServer = store.servers.find((s) => s.id === store.currentServerId)
  const currentChannel = currentServer?.channels.find((c) => c.id === store.currentChannelId)

  const context = useMemo(
    () => ({
      store,
      ircClient: ircClient || ({} as never),
      currentServer,
      currentChannel,
      renderer,
    }),
    [store, ircClient, currentServer, currentChannel, renderer]
  )

  const allChannels = useMemo(() => {
    const channels: {
      serverId: string
      serverName: string
      channelId: string
      channelName: string
      unreadCount: number
      isMentioned: boolean
    }[] = []
    for (const server of store.servers) {
      for (const channel of server.channels) {
        channels.push({
          serverId: server.id,
          serverName: server.name,
          channelId: channel.id,
          channelName: channel.name,
          unreadCount: channel.unreadCount,
          isMentioned: channel.isMentioned,
        })
      }
    }
    return channels
  }, [store.servers])

  const visibleActions = useMemo(() => {
    return registry.getAll().filter((action: Action<AppStore>) => {
      if (action.isVisible && !action.isVisible(context)) return false
      return true
    })
  }, [registry, context])

  const buildDefaultItems = useCallback((): QuickItem[] => {
    const items: QuickItem[] = []

    for (const ch of allChannels) {
      if (ch.isMentioned) {
        items.push({
          id: `mention-${ch.channelId}`,
          label: ch.channelName,
          sublabel: ch.serverName,
          fg: THEME.error,
          kind: 'channel',
          serverId: ch.serverId,
          channelId: ch.channelId,
        })
      }
    }

    for (const ch of allChannels) {
      if (ch.unreadCount > 0 && !ch.isMentioned) {
        items.push({
          id: `unread-${ch.channelId}`,
          label: `${ch.channelName} (${ch.unreadCount})`,
          sublabel: ch.serverName,
          kind: 'channel',
          serverId: ch.serverId,
          channelId: ch.channelId,
        })
      }
    }

    return items
  }, [allChannels])

  const buildTextQueryItems = useCallback(
    (q: string): QuickItem[] => {
      const channelItems: QuickItem[] = allChannels.map((ch) => ({
        id: `ch-${ch.channelId}`,
        label: ch.channelName,
        sublabel: ch.serverName,
        kind: 'channel' as const,
        serverId: ch.serverId,
        channelId: ch.channelId,
      }))

      const actionItems: QuickItem[] = visibleActions.map((action: Action<AppStore>) => ({
        id: `act-${action.id}`,
        label: action.label,
        sublabel: action.description,
        kind: 'action' as const,
        actionId: action.id,
      }))

      const combined = [...channelItems, ...actionItems]
      const fuse = new Fuse(combined, {
        keys: ['label', 'sublabel'],
        threshold: 0.4,
      })

      return fuse.search(q).map((r) => r.item)
    },
    [allChannels, visibleActions]
  )

  const buildHashItems = useCallback(
    (q: string): QuickItem[] => {
      const search = q.slice(1)
      const items: QuickItem[] = []

      const fuse = new Fuse(allChannels, {
        keys: ['channelName'],
        threshold: 0.4,
      })

      const results = search ? fuse.search(search).map((r) => r.item) : allChannels

      const normalizedSearch = search.startsWith('#') ? search : `#${search}`
      const exactMatch = allChannels.find(
        (ch) => ch.channelName.toLowerCase() === normalizedSearch.toLowerCase()
      )

      if (!exactMatch && search) {
        items.push({
          id: `join-${search}`,
          label: `Join #${search.replace(/^#/, '')}`,
          sublabel: currentServer?.name,
          fg: THEME.accentGreen,
          kind: 'join',
        })
      }

      for (const ch of results) {
        items.push({
          id: `ch-${ch.channelId}`,
          label: ch.channelName,
          sublabel: ch.serverName,
          kind: 'channel',
          serverId: ch.serverId,
          channelId: ch.channelId,
        })
      }

      if (exactMatch) {
        items.push({
          id: `leave-${exactMatch.channelId}`,
          label: `Leave ${exactMatch.channelName}`,
          sublabel: exactMatch.serverName,
          fg: THEME.error,
          kind: 'leave',
          serverId: exactMatch.serverId,
          channelId: exactMatch.channelId,
        })
      }

      return items
    },
    [allChannels, currentServer?.name]
  )

  const buildAtItems = useCallback(
    (q: string): QuickItem[] => {
      const search = q.slice(1)
      const users = currentChannel?.users ?? []

      const fuse = new Fuse(users, {
        keys: ['username', 'nickname'],
        threshold: 0.4,
      })

      const results = search ? fuse.search(search).map((r) => r.item) : users

      return results.map((user) => ({
        id: `user-${user.id}`,
        label: `@${user.nickname || user.username}`,
        sublabel: user.account ?? undefined,
        fg: THEME.accentPink,
        kind: 'user' as const,
        username: user.username,
      }))
    },
    [currentChannel?.users]
  )

  const items = useMemo(() => {
    if (!query) return buildDefaultItems()
    if (query.startsWith('#')) return buildHashItems(query)
    if (query.startsWith('@')) return buildAtItems(query)
    return buildTextQueryItems(query)
  }, [query, buildDefaultItems, buildHashItems, buildAtItems, buildTextQueryItems])

  const modalWidth = Math.min(60, width - 4)
  const modalHeight = Math.min(20, height - 4)
  const visibleItems = items.slice(0, modalHeight - 5)

  const handleSelect = (item: QuickItem) => {
    switch (item.kind) {
      case 'channel':
        if (item.serverId) store.setCurrentServer(item.serverId)
        if (item.channelId) store.setCurrentChannel(item.channelId)
        closeModal()
        break

      case 'action':
        // Close quick actions FIRST so the action can open its own modal
        closeModal()
        if (item.actionId && ircClient) {
          registry.execute(item.actionId, { ...context, ircClient })
        }
        break

      case 'join': {
        const channelName = query.slice(1).replace(/^#/, '')
        closeModal()
        if (ircClient && currentServer) {
          registry.execute('channel.join', { ...context, ircClient }, `#${channelName}`)
        }
        break
      }

      case 'leave':
        if (item.channelId && item.serverId && ircClient) {
          const server = store.servers.find((s) => s.id === item.serverId)
          const channel = server?.channels.find((c) => c.id === item.channelId)
          if (server && channel) {
            registry.execute('channel.part', {
              ...context,
              ircClient,
              currentServer: server,
              currentChannel: channel,
            })
          }
        }
        closeModal()
        break

      case 'user':
        if (item.username && ircClient && currentServer) {
          let pc = currentServer.privateChats.find((p) => p.username === item.username)
          if (!pc) {
            pc = {
              id: uuidv4(),
              username: item.username,
              serverId: currentServer.id,
              unreadCount: 0,
              isMentioned: false,
            }
            store.addPrivateChat(currentServer.id, pc)
          }
          store.setCurrentServer(currentServer.id)
          store.setCurrentChannel(pc.id)
        }
        closeModal()
        break
    }
  }

  // Intercept navigation keys — prevent <input> from processing them
  useKeyboard((key) => {
    if (key.name === 'escape') {
      closeModal()
      return
    }

    if (key.name === 'tab') {
      key.preventDefault()
      if (key.shift) {
        setSelectedIndex((prev) => Math.max(0, prev - 1))
      } else {
        setSelectedIndex((prev) => Math.min(visibleItems.length - 1, prev + 1))
      }
      return
    }

    if (key.name === 'up') {
      key.preventDefault()
      setSelectedIndex((prev) => Math.max(0, prev - 1))
      return
    }

    if (key.name === 'down') {
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
    const item = visibleItems[selectedIndex]
    if (item) handleSelect(item)
  }

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
        <span fg={THEME.accent}>↑↓</span> Navigate <span fg={THEME.accent}>Enter</span> Select
      </text>
      <text fg={THEME.mutedText}>
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
      title="Quick Actions"
      footer={footer}
    >
      <box paddingLeft={2} paddingRight={2} height={1} backgroundColor={THEME.backgroundElement}>
        <input
          focused
          value={query}
          onInput={handleQueryInput}
          onSubmit={handleQuerySubmit}
          placeholder=""
          flexGrow={1}
          backgroundColor={THEME.backgroundElement}
          focusedBackgroundColor={THEME.backgroundElement}
        />
      </box>

      <scrollbox height={modalHeight - 4}>
        {visibleItems.length === 0 ? (
          <box paddingLeft={2} paddingTop={1}>
            <text fg={THEME.mutedText}>
              {query ? 'No results found' : 'No mentions or unreads'}
            </text>
          </box>
        ) : (
          visibleItems.map((item, index) => (
            <box
              key={item.id}
              paddingLeft={2}
              paddingRight={2}
              backgroundColor={index === selectedIndex ? THEME.selectedBackground : undefined}
            >
              <box flexDirection="row" gap={1}>
                <text fg={item.fg ?? (index === selectedIndex ? THEME.accent : THEME.foreground)}>
                  {item.label}
                </text>
                {item.sublabel && <text fg={THEME.mutedText}>{item.sublabel}</text>}
              </box>
            </box>
          ))
        )}
      </scrollbox>
    </ModalShell>
  )
}
