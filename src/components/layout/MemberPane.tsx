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

  // IRC prefix symbols in privilege order (highest first)
  const PREFIX_ORDER = ['~', '&', '@', '%', '+'] as const
  type Prefix = (typeof PREFIX_ORDER)[number]

  const PREFIX_COLOR: Record<Prefix, string> = {
    '~': THEME.error, // Owner
    '&': THEME.accentYellow, // Admin
    '@': THEME.accentGreen, // Op
    '%': THEME.accentCyan, // Half-op
    '+': THEME.accentPurple, // Voice
  }

  const getHighestPrefix = (user: User): Prefix | '' => {
    const status = user.status ?? ''
    return PREFIX_ORDER.find((p) => status.includes(p)) ?? ''
  }

  const getUserModeSymbol = (user: User) => getHighestPrefix(user)

  const getModeColor = (user: User) => {
    const prefix = getHighestPrefix(user)
    return prefix ? PREFIX_COLOR[prefix] : undefined
  }

  const sortUsers = (users: User[]) => {
    return [...users].sort((a, b) => {
      const getModeWeight = (user: User) => {
        const prefix = getHighestPrefix(user)
        if (!prefix) return PREFIX_ORDER.length
        return PREFIX_ORDER.indexOf(prefix)
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
