import type { CliRenderer } from '@opentui/core'
import type { IRCClient } from '../../ObsidianIRC/src/lib/ircClient'

export interface Server {
  id: string
  name: string
  host: string
  port: number
  ssl?: boolean
  nickname: string
  username?: string
  realname?: string
  password?: string
  saslUsername?: string
  saslPassword?: string
  isConnected?: boolean
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  channels: Channel[]
  privateChats: PrivateChat[]
  capabilities?: string[]
}

export interface PrivateChat {
  id: string
  username: string
  serverId: string
  unreadCount: number
  isMentioned: boolean
  lastActivity?: Date
}

export interface Channel {
  id: string
  name: string
  serverId: string
  topic?: string
  users: User[]
  messages: Message[]
  unreadCount: number
  isPrivate: boolean
  isMentioned: boolean
}

export interface User {
  id: string
  username: string
  nickname?: string
  modes?: string[]
  isOnline: boolean
  isAway?: boolean
  awayMessage?: string
  status?: string
  account?: string
  realname?: string
}

export interface Message {
  id: string
  msgid?: string
  multilineMessageIds?: string[]
  channelId: string
  serverId: string
  userId: string
  content: string
  timestamp: Date
  type:
    | 'message'
    | 'action'
    | 'notice'
    | 'system'
    | 'join'
    | 'part'
    | 'quit'
    | 'kick'
    | 'nick'
    | 'mode'
    | 'whisper'
    | 'invite'
  tags?: Record<string, string>
  replyTo?: string
  replyMessage: Message | null
  reactions: Array<{ emoji: string; userId: string }>
  mentioned: string[]
  isMultiline?: boolean
  lines?: string[]
}

export interface ActionContext<TStore = unknown> {
  store: TStore
  ircClient: IRCClient
  currentServer?: Server
  currentChannel?: Channel
  selectedMessage?: Message
  selectedUser?: User
  renderer: CliRenderer
}

export type ActionCategory =
  | 'server'
  | 'channel'
  | 'message'
  | 'user'
  | 'navigation'
  | 'ui'
  | 'system'

export interface Action<TStore = unknown, TParams extends unknown[] = unknown[]> {
  id: string
  label: string
  description?: string
  category: ActionCategory
  keybinding?: string
  icon?: string
  execute: (context: ActionContext<TStore>, ...params: TParams) => Promise<void> | void
  isEnabled?: (context: ActionContext<TStore>) => boolean
  isVisible?: (context: ActionContext<TStore>) => boolean
  keywords?: string[]
  priority?: number
}

export interface UIState {
  activeModal: string | null
  focusedPane: 'servers' | 'chat' | 'users'
  focusedChannel: string | null
  showServerPane: boolean
  showUserPane: boolean
  selectedMessage: Message | null
  replyingTo: Message | null
  terminalWidth: number
  terminalHeight: number
  currentServerId: string | null
  currentChannelId: string | null
  quitWarning: string | null
  inputLineCount: number
  expandMultilines: boolean
  modalError: string | null
  messageSearch: { query: string; matchIds: string[]; currentIndex: number; typing: boolean } | null
}

export interface Settings {
  theme: 'dark' | 'light'
  compactMode: boolean
  showTimestamps: boolean
  timestampFormat: string
  highlights: string[]
}
