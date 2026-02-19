import { useStore } from '../../store'
import { THEME } from '../../constants/theme'
import { SplitBorderRight } from '../../constants/borders'
import type { Server, Channel, PrivateChat } from '../../types'

interface ServerPaneProps {
  width: number
  height: number
  focused: boolean
}

// Alt+1..9 → indices 0..8, Alt+0 → index 9, >9 → no shortcut
function bufferLabel(idx: number): string {
  if (idx < 9) return String(idx + 1)
  if (idx === 9) return '0'
  return ''
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

  // Buffer index counter — same traversal order as getBufferList in channelActions
  let bufferIdx = 0

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
          servers.map((server) => {
            const serverIdx = bufferIdx++

            return (
              <box key={server.id} flexDirection="column" marginBottom={2}>
                {/* Server row */}
                <box
                  flexDirection="row"
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
                  <box width={2} flexShrink={0}>
                    <text fg={THEME.dimText}>{bufferLabel(serverIdx)}</text>
                  </box>
                  <text>
                    <span fg={getConnectionColor(server)}>{getConnectionIcon(server)}</span>
                    <span fg={THEME.accentBlue}> {server.name}</span>
                  </text>
                </box>

                {server.channels.map((channel: Channel) => {
                  const chIdx = bufferIdx++
                  return (
                    <box
                      key={channel.id}
                      flexDirection="row"
                      paddingRight={1}
                      backgroundColor={
                        currentChannelId === channel.id ? THEME.selectedBackground : undefined
                      }
                      onMouseDown={() => handleSelectChannel(server.id, channel.id)}
                    >
                      <box width={2} flexShrink={0}>
                        <text fg={THEME.dimText}>{bufferLabel(chIdx)}</text>
                      </box>
                      <box paddingLeft={1}>
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
                    </box>
                  )
                })}

                {server.privateChats.map((chat: PrivateChat) => {
                  const pmIdx = bufferIdx++
                  return (
                    <box
                      key={chat.id}
                      flexDirection="row"
                      paddingRight={1}
                      backgroundColor={
                        currentChannelId === chat.id ? THEME.selectedBackground : undefined
                      }
                      onMouseDown={() => handleSelectChannel(server.id, chat.id)}
                    >
                      <box width={2} flexShrink={0}>
                        <text fg={THEME.dimText}>{bufferLabel(pmIdx)}</text>
                      </box>
                      <box paddingLeft={1}>
                        <text>
                          <span fg={THEME.accentPink}>@ </span>
                          <span
                            fg={currentChannelId === chat.id ? THEME.accentBlue : THEME.foreground}
                          >
                            {chat.username}
                          </span>
                          {chat.unreadCount > 0 && (
                            <span fg={THEME.mutedText}> ({chat.unreadCount})</span>
                          )}
                        </text>
                      </box>
                    </box>
                  )
                })}
              </box>
            )
          })
        )}
      </scrollbox>
    </box>
  )
}
