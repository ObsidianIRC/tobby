import { useStore } from '../../store'
import { THEME } from '../../constants/theme'

interface StatusBarProps {
  width: number
  height: number
}

export function StatusBar({ width }: StatusBarProps) {
  const currentServerId = useStore((state) => state.currentServerId)
  const currentChannelId = useStore((state) => state.currentChannelId)
  const servers = useStore((state) => state.servers)

  const currentServer = servers.find((s) => s.id === currentServerId)
  const currentChannel = currentServer?.channels.find((c) => c.id === currentChannelId)

  const getConnectionStatus = () => {
    if (!currentServer) return ''

    switch (currentServer.connectionState) {
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

  const getStatusColor = () => {
    if (!currentServer) return THEME.mutedText

    switch (currentServer.connectionState) {
      case 'connected':
        return THEME.success
      case 'connecting':
      case 'reconnecting':
        return THEME.warning
      default:
        return THEME.error
    }
  }

  return (
    <box
      width={width}
      height={1}
      backgroundColor={THEME.background}
      flexDirection="row"
      justifyContent="space-between"
      paddingLeft={1}
      paddingRight={1}
    >
      <box flexDirection="row" gap={2}>
        {currentServer && (
          <>
            <text>
              <span fg={getStatusColor()}>{getConnectionStatus()}</span>
              <span fg={THEME.foreground}> {currentServer.name}</span>
            </text>
          </>
        )}

        {currentChannel && (
          <>
            <text fg={THEME.border}>|</text>
            <text fg={THEME.accent}>{currentChannel.name}</text>
          </>
        )}
      </box>

      <box>
        <text fg={THEME.mutedText}>
          <span fg={THEME.accent}>Ctrl+K</span> commands <span fg={THEME.border}>|</span>{' '}
          <span fg={THEME.accent}>Ctrl+D</span> quit
        </text>
      </box>
    </box>
  )
}
