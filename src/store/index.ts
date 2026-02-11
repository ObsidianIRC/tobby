import { create } from 'zustand'
import { createServersSlice, type ServersSlice } from './slices/serversSlice'
import { createMessagesSlice, type MessagesSlice } from './slices/messagesSlice'
import { createUISlice, type UISlice } from './slices/uiSlice'
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice'
import { createIRCSlice, type IRCSlice } from './slices/ircSlice'

export type AppStore = ServersSlice & MessagesSlice & UISlice & SettingsSlice & IRCSlice

export const useStore = create<AppStore>()((...args) => ({
  ...createServersSlice(...args),
  ...createMessagesSlice(...args),
  ...createUISlice(...args),
  ...createSettingsSlice(...args),
  ...createIRCSlice(...args),
}))
