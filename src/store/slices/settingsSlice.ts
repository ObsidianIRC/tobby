import type { Settings } from '@/types'
import type { StateCreator } from 'zustand'

export interface SettingsSlice extends Settings {
  updateSettings: (settings: Partial<Settings>) => void
  addHighlight: (term: string) => void
  removeHighlight: (term: string) => void
}

export const createSettingsSlice: StateCreator<SettingsSlice> = (set) => ({
  theme: 'dark',
  compactMode: false,
  showTimestamps: true,
  timestampFormat: 'HH:mm:ss',
  highlights: [],

  updateSettings: (settings) => set(settings),
  addHighlight: (term) =>
    set((state) => ({
      highlights: [...state.highlights, term],
    })),
  removeHighlight: (term) =>
    set((state) => ({
      highlights: state.highlights.filter((h) => h !== term),
    })),
})
