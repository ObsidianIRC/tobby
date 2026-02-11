import type { Message, UIState } from '@/types'
import type { StateCreator } from 'zustand'

export interface UISlice extends UIState {
  openModal: (modalId: string) => void
  closeModal: () => void
  setFocusedPane: (pane: 'servers' | 'chat' | 'users') => void
  setFocusedChannel: (channelId: string | null) => void
  toggleServerPane: () => void
  toggleUserPane: () => void
  setSelectedMessage: (message: Message | null) => void
  setReplyingTo: (message: Message | null) => void
  setTerminalDimensions: (width: number, height: number) => void
  setCurrentServer: (serverId: string | null) => void
  setCurrentChannel: (channelId: string | null) => void
}

export const createUISlice: StateCreator<UISlice> = (set) => ({
  activeModal: null,
  focusedPane: 'chat',
  focusedChannel: null,
  showServerPane: true,
  showUserPane: true,
  selectedMessage: null,
  replyingTo: null,
  terminalWidth: 80,
  terminalHeight: 24,
  currentServerId: null,
  currentChannelId: null,

  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),
  setFocusedPane: (pane) => set({ focusedPane: pane }),
  setFocusedChannel: (channelId) => set({ focusedChannel: channelId }),
  toggleServerPane: () => set((state) => ({ showServerPane: !state.showServerPane })),
  toggleUserPane: () => set((state) => ({ showUserPane: !state.showUserPane })),
  setSelectedMessage: (message) => set({ selectedMessage: message }),
  setReplyingTo: (message) => set({ replyingTo: message }),
  setTerminalDimensions: (width, height) => set({ terminalWidth: width, terminalHeight: height }),
  setCurrentServer: (serverId) => set({ currentServerId: serverId }),
  setCurrentChannel: (channelId) => set({ currentChannelId: channelId }),
})
