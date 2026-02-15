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
      borderColor={focused ? THEME.borderFocus : THEME.border}
      flexDirection="column"
      backgroundColor={THEME.backgroundServer}
      overflow="scroll"
    >
      <scrollbox focused={focused} height={height - 2}>
        {servers.length === 0 ? (
          <box />
        ) : (
          servers.map((server) => (
            <box key={server.id} flexDirection="column" marginBottom={2}>
              <box
                flexDirection="row"
                gap={1}
                paddingLeft={1}
                paddingRight={1}
                paddingTop={1}
                backgroundColor={
                  currentServerId === server.id ? THEME.backgroundHighlight : undefined
                }
                onMouseDown={() => {
                  setCurrentServer(server.id)
                  setCurrentChannel(null)
                }}
              >
                <text>
                  <span fg={getConnectionColor(server)}>{getConnectionIcon(server)}</span>
                  <span fg={THEME.accentBlue}> {server.name}</span>
                </text>
              </box>

              {server.channels.map((channel: Channel) => (
                <box
                  key={channel.id}
                  paddingLeft={3}
                  backgroundColor={
                    currentChannelId === channel.id ? THEME.selectedBackground : undefined
                  }
                  onMouseDown={() => handleSelectChannel(server.id, channel.id)}
                >
                  <text>
                    <span
                      fg={
                        channel.isMentioned
                          ? THEME.error
                          : currentChannelId === channel.id
                            ? THEME.accentBlue
                            : THEME.foreground
                      }
                    >
                      {channel.name}
                    </span>
                    {channel.unreadCount > 0 && (
                      <span fg={THEME.mutedText}> ({channel.unreadCount})</span>
                    )}
                  </text>
                </box>
              ))}

              {server.privateChats.map((chat: PrivateChat) => (
                <box
                  key={chat.id}
                  paddingLeft={3}
                  backgroundColor={
                    currentChannelId === chat.id ? THEME.selectedBackground : undefined
                  }
                  onMouseDown={() => handleSelectChannel(server.id, chat.id)}
                >
                  <text>
                    <span fg={THEME.accentPink}>@ </span>
                    <span fg={currentChannelId === chat.id ? THEME.accentBlue : THEME.foreground}>
                      {chat.username}
                    </span>
                    {chat.unreadCount > 0 && (
                      <span fg={THEME.mutedText}> ({chat.unreadCount})</span>
                    )}
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
