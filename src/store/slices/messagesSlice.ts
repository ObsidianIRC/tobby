import type { Message } from '@/types'
import type { StateCreator } from 'zustand'

export interface MessagesSlice {
  messages: Map<string, Message[]>
  addMessage: (channelId: string, message: Message) => void
  updateMessage: (channelId: string, messageId: string, updates: Partial<Message>) => void
  removeMessage: (channelId: string, messageId: string) => void
  getMessages: (channelId: string) => Message[]
  clearMessages: (channelId: string) => void
}

export const createMessagesSlice: StateCreator<MessagesSlice> = (set, get) => ({
  messages: new Map(),

  addMessage: (channelId, message) =>
    set((state) => {
      const newMessages = new Map(state.messages)
      const existing = newMessages.get(channelId) || []
      newMessages.set(channelId, [...existing, message])
      return { messages: newMessages }
    }),

  updateMessage: (channelId, messageId, updates) =>
    set((state) => {
      const newMessages = new Map(state.messages)
      const existing = newMessages.get(channelId) || []
      newMessages.set(
        channelId,
        existing.map((m) => (m.id === messageId ? { ...m, ...updates } : m))
      )
      return { messages: newMessages }
    }),

  removeMessage: (channelId, messageId) =>
    set((state) => {
      const newMessages = new Map(state.messages)
      const existing = newMessages.get(channelId) || []
      newMessages.set(
        channelId,
        existing.filter((m) => m.id !== messageId)
      )
      return { messages: newMessages }
    }),

  getMessages: (channelId) => {
    const state = get()
    return state.messages.get(channelId) || []
  },

  clearMessages: (channelId) =>
    set((state) => {
      const newMessages = new Map(state.messages)
      newMessages.delete(channelId)
      return { messages: newMessages }
    }),
})
