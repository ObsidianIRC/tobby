import { useStore } from '../../store'
import { THEME, COLORS } from '../../constants/theme'
import { SplitBorder } from '../../constants/borders'
import type { User } from '../../types'

interface MemberPaneProps {
  width: number
  height: number
  focused: boolean
}

export function MemberPane({ width, height, focused }: MemberPaneProps) {
  const currentServerId = useStore((state) => state.currentServerId)
  const currentChannelId = useStore((state) => state.currentChannelId)
  const servers = useStore((state) => state.servers)

  const currentServer = servers.find((s) => s.id === currentServerId)
  const currentChannel = currentServer?.channels.find((c) => c.id === currentChannelId)

  const getUserModeSymbol = (user: User) => {
    if (!user.modes || user.modes.length === 0) return ''

    const mode = user.modes[0]
    switch (mode) {
      case 'o':
        return '@'
      case 'h':
        return '%'
      case 'v':
        return '+'
      case 'q':
        return '~'
      case 'a':
        return '&'
      default:
        return ''
    }
  }

  const sortUsers = (users: User[]) => {
    return [...users].sort((a, b) => {
      const getModeWeight = (user: User) => {
        if (!user.modes || user.modes.length === 0) return 5
        const mode = user.modes[0]
        switch (mode) {
          case 'q':
            return 0
          case 'a':
            return 1
          case 'o':
            return 2
          case 'h':
            return 3
          case 'v':
            return 4
          default:
            return 5
        }
      }

      const weightA = getModeWeight(a)
      const weightB = getModeWeight(b)

      if (weightA !== weightB) {
        return weightA - weightB
      }

      const nameA = (a.nickname || a.username).toLowerCase()
      const nameB = (b.nickname || b.username).toLowerCase()
      return nameA.localeCompare(nameB)
    })
  }

  if (!currentChannel) {
    return (
      <box
        width={width}
        height={height}
        {...SplitBorder}
        borderColor={focused ? THEME.borderActive : THEME.border}
        backgroundColor={THEME.background}
        flexDirection="column"
      >
        <box />
      </box>
    )
  }

  const sortedUsers = sortUsers(currentChannel.users)

  return (
    <box
      width={width}
      height={height}
      {...SplitBorder}
      borderColor={focused ? THEME.borderActive : THEME.border}
      backgroundColor={THEME.background}
      flexDirection="column"
    >
      <scrollbox focused={focused} height={height - 2}>
        {sortedUsers.length === 0 ? (
          <box />
        ) : (
          sortedUsers.map((user) => {
            const modeSymbol = getUserModeSymbol(user)
            const displayName = user.nickname || user.username
            const isAway = user.isAway

            return (
              <box key={user.id} paddingLeft={1} paddingRight={1}>
                <text fg={isAway ? THEME.mutedText : THEME.foreground}>
                  {modeSymbol && <span fg={COLORS.yellow}>{modeSymbol}</span>}
                  {displayName}
                  {isAway && <span fg={THEME.inactive}> (away)</span>}
                </text>
              </box>
            )
          })
        )}
      </scrollbox>
    </box>
  )
}
