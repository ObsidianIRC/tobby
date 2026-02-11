import { useStore } from '../../store'
import { THEME } from '../../constants/theme'
import { SplitBorderRight } from '../../constants/borders'
import type { Server, Channel, PrivateChat } from '../../types'

interface ServerPaneProps {
  width: number
  height: number
  focused: boolean
}

export function ServerPane({ width, height, focused }: ServerPaneProps) {
  const servers = useStore((state) => state.servers)
  const currentServerId = useStore((state) => state.currentServerId)
  const currentChannelId = useStore((state) => state.currentChannelId)
  const setCurrentServer = useStore((state) => state.setCurrentServer)
  const setCurrentChannel = useStore((state) => state.setCurrentChannel)

  const handleSelectChannel = (serverId: string, channelId: string) => {
    setCurrentServer(serverId)
    setCurrentChannel(channelId)
  }

  const getConnectionIcon = (server: Server) => {
    switch (server.connectionState) {
      case 'connected':
        return '●'
      case 'connecting':
        return '◐'
      case 'reconnecting':
        return '◑'
      default:
        return '○'
    }
  }

  const getConnectionColor = (server: Server) => {
    switch (server.connectionState) {
      case 'connected':
        return THEME.success
      case 'connecting':
      case 'reconnecting':
        return THEME.warning
      default:
        return THEME.mutedText
    }
  }

  return (
    <box
      width={width}
      height={height}
      {...SplitBorderRight}
      borderColor={focused ? THEME.borderActive : THEME.border}
      flexDirection="column"
      backgroundColor={THEME.background}
      overflow="scroll"
    >
      <scrollbox focused={focused} height={height - 2}>
        {servers.length === 0 ? (
          <box />
        ) : (
          servers.map((server) => (
            <box key={server.id} flexDirection="column" marginBottom={1}>
              <box
                flexDirection="row"
                gap={1}
                paddingLeft={1}
                paddingRight={1}
                paddingTop={1}
                paddingBottom={1}
                backgroundColor={
                  currentServerId === server.id ? THEME.highlightBackground : undefined
                }
                onMouseDown={() => {
                  setCurrentServer(server.id)
                  // Optional: clear current channel if selecting server root
                  setCurrentChannel(null)
                }}
              >
                <text fg={getConnectionColor(server)}>{getConnectionIcon(server)}</text>
                <text fg={THEME.foreground}>
                  <strong>{server.name}</strong>
                </text>
              </box>

              {server.channels.map((channel: Channel) => (
                <box
                  key={channel.id}
                  paddingLeft={3}
                  paddingTop={1}
                  paddingBottom={1}
                  backgroundColor={
                    currentChannelId === channel.id ? THEME.selectedBackground : undefined
                  }
                  onMouseDown={() => handleSelectChannel(server.id, channel.id)}
                >
                  <text fg={THEME.foreground}>
                    {channel.isMentioned && <span fg={THEME.error}>! </span>}
                    {channel.unreadCount > 0 && (
                      <span fg={THEME.warning}>({channel.unreadCount}) </span>
                    )}
                    {channel.name}
                  </text>
                </box>
              ))}

              {server.privateChats.map((chat: PrivateChat) => (
                <box
                  key={chat.id}
                  paddingLeft={3}
                  paddingTop={1}
                  paddingBottom={1}
                  backgroundColor={
                    currentChannelId === chat.id ? THEME.selectedBackground : undefined
                  }
                  onMouseDown={() => handleSelectChannel(server.id, chat.id)}
                >
                  <text fg={THEME.foreground}>
                    {chat.isMentioned && <span fg={THEME.error}>! </span>}
                    {chat.unreadCount > 0 && <span fg={THEME.warning}>({chat.unreadCount}) </span>}@
                    {chat.username}
                  </text>
                </box>
              ))}
            </box>
          ))
        )}
      </scrollbox>
    </box>
  )
}
