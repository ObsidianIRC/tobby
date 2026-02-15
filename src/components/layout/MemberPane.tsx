import { useStore } from '../../store'
import { THEME, NICKNAME_COLORS } from '../../constants/theme'
import { SplitBorder } from '../../constants/borders'
import type { User } from '../../types'

// Hash function for consistent nickname colors
const hashString = (str: string): number => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash)
}

const getNicknameColor = (nickname: string): string => {
  const index = hashString(nickname) % NICKNAME_COLORS.length
  return NICKNAME_COLORS[index] ?? THEME.foreground
}

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

  const getModeColor = (user: User) => {
    if (!user.modes || user.modes.length === 0) return undefined

    const mode = user.modes[0]
    switch (mode) {
      case 'q':
        return THEME.error // Owner - red
      case 'a':
        return THEME.accentYellow // Admin - gold
      case 'o':
        return THEME.accentGreen // Op - green
      case 'h':
        return THEME.accentCyan // Half-op - cyan
      case 'v':
        return THEME.accentPurple // Voice - purple
      default:
        return undefined
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
        borderColor={focused ? THEME.borderFocus : THEME.border}
        backgroundColor={THEME.backgroundMembers}
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
      borderColor={focused ? THEME.borderFocus : THEME.border}
      backgroundColor={THEME.backgroundMembers}
      flexDirection="column"
    >
      <box
        height={2}
        paddingLeft={1}
        paddingTop={1}
        backgroundColor={THEME.backgroundHighlight}
        border={['bottom']}
        borderColor={THEME.borderSubtle}
      >
        <text>
          <span fg={THEME.mutedText}>Members ({sortedUsers.length})</span>
        </text>
      </box>
      <scrollbox focused={focused} height={height - 4}>
        {sortedUsers.length === 0 ? (
          <box />
        ) : (
          sortedUsers.map((user) => {
            const modeSymbol = getUserModeSymbol(user)
            const modeColor = getModeColor(user)
            const displayName = user.nickname || user.username
            const isAway = user.isAway
            const nicknameColor = isAway ? THEME.mutedText : getNicknameColor(displayName)

            return (
              <box key={user.id} paddingLeft={1} paddingRight={1}>
                <text>
                  {modeSymbol && <span fg={modeColor}>{modeSymbol}</span>}
                  <span fg={nicknameColor}>{displayName}</span>
                  {isAway && <span fg={THEME.dimText}> (away)</span>}
                </text>
              </box>
            )
          })
        )}
      </scrollbox>
    </box>
  )
}
