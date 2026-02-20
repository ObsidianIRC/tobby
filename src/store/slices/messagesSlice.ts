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

      // Deduplicate by msgid — repeated /history calls bring the same messages
      // back with the same msgid, so we skip them instead of double-inserting.
      // Messages without a msgid (system events, old servers) are always inserted.
      if (message.msgid && existing.some((m) => m.msgid === message.msgid)) {
        return state
      }

      const merged = [...existing, message]
      // Sort by server-time timestamp so history blocks slot into the correct
      // chronological position relative to live messages and each other.
      merged.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      // Keep only the most recent 1000 messages per channel to bound memory usage.
      const capped = merged.length > 1000 ? merged.slice(merged.length - 1000) : merged
      newMessages.set(channelId, capped)
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
