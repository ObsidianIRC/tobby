import { describe, it, expect } from 'vitest'
import { EMOJI_LIST } from '@/utils/emojiData'

describe('EMOJI_LIST', () => {
  it('is non-empty', () => {
    expect(EMOJI_LIST.length).toBeGreaterThan(100)
  })

  it('each entry has char, name, and keywords', () => {
    for (const entry of EMOJI_LIST.slice(0, 20)) {
      expect(typeof entry.char).toBe('string')
      expect(entry.char.length).toBeGreaterThan(0)
      expect(typeof entry.name).toBe('string')
      expect(Array.isArray(entry.keywords)).toBe(true)
    }
  })

  it('includes common emoji by name', () => {
    const thumbsUp = EMOJI_LIST.find((e) => e.name === 'thumbs_up')
    expect(thumbsUp).toBeDefined()
    expect(thumbsUp!.char).toBe('👍')
  })

  it('name is not the emoji char itself', () => {
    for (const entry of EMOJI_LIST.slice(0, 10)) {
      expect(entry.name).not.toBe(entry.char)
    }
  })
})
