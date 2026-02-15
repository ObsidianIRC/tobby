import { useState, useMemo } from 'react'
import { useStore } from '../../store'
import { useAppContext } from '../../context/AppContext'
import { ListModal } from './ListModal'
import type { ListItem } from './ListModal'

interface RemoveServerModalProps {
  width: number
  height: number
}

export function RemoveServerModal({ width, height }: RemoveServerModalProps) {
  const [query, setQuery] = useState('')
  const { ircClient } = useAppContext()
  const store = useStore()
  const closeModal = useStore((state) => state.closeModal)

  const items: ListItem[] = useMemo(() => {
    return store.servers.map((server) => ({
      id: server.id,
      label: server.name,
      sublabel: `${server.host}:${server.port}`,
    }))
  }, [store.servers])

  const handleSelect = (item: ListItem) => {
    const server = store.servers.find((s) => s.id === item.id)
    if (!server) return

    if (server.isConnected && ircClient) {
      ircClient.disconnect(server.id)
    }

    store.removeServer(server.id)

    if (store.currentServerId === server.id) {
      store.setCurrentServer(null)
      store.setCurrentChannel(null)
    }

    closeModal()
  }

  return (
    <ListModal
      width={width}
      height={height}
      title="Remove Server"
      items={items}
      query={query}
      onQueryChange={setQuery}
      onSelect={handleSelect}
      onCancel={closeModal}
      placeholder="Select server to remove..."
      emptyMessage="No servers"
    />
  )
}
