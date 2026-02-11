export interface ServerConfig {
  id: string
  name: string
  host: string
  port: number
  ssl: boolean
  nickname: string
  realname?: string
  username?: string
  autoConnect: boolean
  autoJoin: string[]
  sasl?: {
    username: string
    password: string
  }
}

export interface ThemeConfig {
  background: string
  foreground: string
  accent: string
  border: string
  mutedText: string
}

export interface KeybindingsConfig {
  scrollUp: string
  scrollDown: string
  pageUp: string
  pageDown: string
  topOfBuffer: string
  bottomOfBuffer: string
  quickActions: string
}

export interface AppConfig {
  version: string
  defaultNick: string
  servers: ServerConfig[]
  theme: ThemeConfig
  keybindings: KeybindingsConfig
}

export const DEFAULT_CONFIG: AppConfig = {
  version: '1.0.0',
  defaultNick: 'obbyUser',
  servers: [],
  theme: {
    background: '#1a1b26',
    foreground: '#c0caf5',
    accent: '#7aa2f7',
    border: '#414868',
    mutedText: '#565f89',
  },
  keybindings: {
    scrollUp: 'k',
    scrollDown: 'j',
    pageUp: 'ctrl+u',
    pageDown: 'ctrl+d',
    topOfBuffer: 'g g',
    bottomOfBuffer: 'G',
    quickActions: 'ctrl+k',
  },
}
