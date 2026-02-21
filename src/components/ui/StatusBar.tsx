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
  const expandMultilines = useStore((state) => state.expandMultilines)

  const currentServer = servers.find((s) => s.id === currentServerId)
  const currentChannel = currentServer?.channels.find((c) => c.id === currentChannelId)
  const currentPrivateChat = currentServer?.privateChats.find((pc) => pc.id === currentChannelId)

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
      backgroundColor={THEME.backgroundPanel}
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
              <span fg={THEME.accentBlue}> {currentServer.name}</span>
            </text>
          </>
        )}

        {currentChannel && (
          <>
            <text fg={THEME.borderSubtle}>│</text>
            <text>
              <span fg={THEME.accentPurple}># </span>
              <span fg={THEME.foreground}>{currentChannel.name}</span>
            </text>
          </>
        )}
        {!currentChannel && currentPrivateChat && (
          <>
            <text fg={THEME.borderSubtle}>│</text>
            <text>
              <span fg={THEME.accentPink}>@ </span>
              <span fg={THEME.foreground}>{currentPrivateChat.username}</span>
            </text>
          </>
        )}
      </box>

      <box flexDirection="row" gap={2}>
        {expandMultilines && (
          <text>
            <span fg={THEME.accentYellow}>≡ ml</span>
          </text>
        )}
        <text>
          <span fg={THEME.accentCyan}>Ctrl+Space</span>
          <span fg={THEME.mutedText}> select </span>
          <span fg={THEME.borderSubtle}>│</span>
          <span fg={THEME.accentCyan}> Ctrl+K</span>
          <span fg={THEME.mutedText}> actions </span>
          <span fg={THEME.borderSubtle}>│</span>
          <span fg={THEME.accentCyan}> Ctrl+O</span>
          <span fg={THEME.mutedText}> multiline</span>
        </text>
      </box>
    </box>
  )
}
