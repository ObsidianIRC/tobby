import type { Message, UIState } from '@/types'
import type { StateCreator } from 'zustand'
import type { AppStore } from '@/store'

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
  setQuitWarning: (msg: string | null) => void
  setInputLineCount: (n: number) => void
  toggleExpandMultilines: () => void
}

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set, get) => ({
  activeModal: null,
  focusedPane: 'chat',
  focusedChannel: null,
  showServerPane: true,
  showUserPane: true,
  selectedMessage: null,
  replyingTo: null,
  quitWarning: null,
  terminalWidth: 80,
  terminalHeight: 24,
  currentServerId: null,
  currentChannelId: null,
  inputLineCount: 1,
  expandMultilines: false,

  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),
  setFocusedPane: (pane) => set({ focusedPane: pane }),
  setFocusedChannel: (channelId) => set({ focusedChannel: channelId }),
  toggleServerPane: () => set((state) => ({ showServerPane: !state.showServerPane })),
  toggleUserPane: () => set((state) => ({ showUserPane: !state.showUserPane })),
  setSelectedMessage: (message) => set({ selectedMessage: message }),
  setReplyingTo: (message) => set({ replyingTo: message }),
  setQuitWarning: (msg) => set({ quitWarning: msg }),
  setInputLineCount: (n) => set({ inputLineCount: n }),
  toggleExpandMultilines: () => set((state) => ({ expandMultilines: !state.expandMultilines })),
  setTerminalDimensions: (width, height) => set({ terminalWidth: width, terminalHeight: height }),
  setCurrentServer: (serverId) => set({ currentServerId: serverId }),
  setCurrentChannel: (channelId) => {
    set({ currentChannelId: channelId })
    if (channelId) {
      const { servers, updateChannel, updatePrivateChat } = get()
      for (const server of servers) {
        const channel = server.channels.find((c) => c.id === channelId)
        if (channel) {
          updateChannel(server.id, channelId, { unreadCount: 0, isMentioned: false })
          return
        }
        const privateChat = server.privateChats.find((pc) => pc.id === channelId)
        if (privateChat) {
          updatePrivateChat(server.id, channelId, { unreadCount: 0, isMentioned: false })
          return
        }
      }
    }
  },
})
