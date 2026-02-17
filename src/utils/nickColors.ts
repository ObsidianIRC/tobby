import { NICKNAME_COLORS, THEME } from '../constants/theme'

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash)
}

export function getNicknameColor(nickname: string): string {
  const index = hashString(nickname) % NICKNAME_COLORS.length
  return NICKNAME_COLORS[index] ?? THEME.foreground
}
