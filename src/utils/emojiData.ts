import emojilib from 'emojilib'

export interface EmojiEntry {
  char: string
  name: string
  keywords: string[]
}

export const EMOJI_LIST: EmojiEntry[] = Object.entries(emojilib).map(([char, keywords]) => ({
  char,
  name: keywords[0] ?? char,
  keywords: keywords.slice(1),
}))
