import { describe, it, expect } from 'vitest'
import { splitLongLine, sendSafeMessage, MAX_IRC_MSG_LENGTH } from '@/utils/ircSend'

// ── splitLongLine ────────────────────────────────────────────────────────────

describe('splitLongLine', () => {
  it('returns the text unchanged when it fits within the limit', () => {
    const text = 'hello world'
    expect(splitLongLine(text)).toEqual([text])
  })

  it('returns a single-element array for text exactly at the limit', () => {
    const text = 'A'.repeat(MAX_IRC_MSG_LENGTH)
    expect(splitLongLine(text)).toHaveLength(1)
  })

  it('splits text that exceeds the limit into multiple parts', () => {
    const text = 'A'.repeat(MAX_IRC_MSG_LENGTH + 1)
    const parts = splitLongLine(text)
    expect(parts.length).toBeGreaterThan(1)
  })

  it('each resulting part fits within the limit', () => {
    const text = 'A'.repeat(MAX_IRC_MSG_LENGTH * 3)
    const parts = splitLongLine(text)
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(MAX_IRC_MSG_LENGTH)
    }
  })

  it('prefers word-boundary splits when possible', () => {
    // 'word '.repeat(89) = 445 chars (within limit), then 'toolong' pushes it over
    const prefix = 'word '.repeat(89).trimEnd() // "word word ... word" — 444 chars
    const overflow = prefix + ' toolong' // 452 chars; space at index 444
    const parts = splitLongLine(overflow)
    // The first part should be the prefix words (split at the space before 'toolong')
    expect(parts[0]).toBe(prefix)
    // The second part should be 'toolong' (leading space trimmed)
    expect(parts[1]).toBe('toolong')
  })

  it('no content is lost when splitting a long text', () => {
    // Use words with no trailing space so trimStart() is a no-op after each split
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`)
    const text = words.join(' ')
    const parts = splitLongLine(text)
    // Reassemble: parts are joined by the split-point spaces that were consumed
    // (trimStart removes the leading space), so joining with ' ' reconstructs the text
    expect(parts.join(' ')).toBe(text)
  })
})

// ── sendSafeMessage ──────────────────────────────────────────────────────────

function makeClient() {
  const sent: string[] = []
  const client = { sendRaw: (_sid: string, line: string) => sent.push(line) }
  return { client, sent }
}

describe('sendSafeMessage — short content', () => {
  it('sends a single PRIVMSG when content fits within the limit', () => {
    const { client, sent } = makeClient()
    sendSafeMessage(client, 'srv1', '#general', 'hello world', ['draft/multiline'])
    expect(sent).toHaveLength(1)
    expect(sent[0]).toBe('PRIVMSG #general :hello world')
  })

  it('does not open a batch for short content even with draft/multiline', () => {
    const { client, sent } = makeClient()
    sendSafeMessage(client, 'srv1', '#general', 'hi', ['draft/multiline'])
    expect(sent.some((l) => l.startsWith('BATCH'))).toBe(false)
  })
})

describe('sendSafeMessage — long content with draft/multiline', () => {
  const longContent = 'A'.repeat(MAX_IRC_MSG_LENGTH + 100)

  it('opens a draft/multiline batch', () => {
    const { client, sent } = makeClient()
    sendSafeMessage(client, 'srv1', '#general', longContent, ['draft/multiline'])
    expect(sent[0]).toMatch(/^BATCH \+\S+ draft\/multiline #general$/)
  })

  it('closes the batch at the end', () => {
    const { client, sent } = makeClient()
    sendSafeMessage(client, 'srv1', '#general', longContent, ['draft/multiline'])
    expect(sent.at(-1)).toMatch(/^BATCH -\S+$/)
  })

  it('first PRIVMSG carries only the batch tag (no concat)', () => {
    const { client, sent } = makeClient()
    sendSafeMessage(client, 'srv1', '#general', longContent, ['draft/multiline'])
    // Line at index 1 is the first PRIVMSG (index 0 is BATCH open)
    expect(sent[1]).toMatch(/^@batch=\S+ PRIVMSG #general :/)
    expect(sent[1]).not.toContain('multiline-concat')
  })

  it('subsequent PRIVMSGs carry draft/multiline-concat', () => {
    const { client, sent } = makeClient()
    sendSafeMessage(client, 'srv1', '#general', longContent, ['draft/multiline'])
    // All PRIVMSG lines after the first should have the concat tag
    const privmsgs = sent.filter((l) => l.includes('PRIVMSG'))
    expect(privmsgs.length).toBeGreaterThan(1)
    for (const line of privmsgs.slice(1)) {
      expect(line).toContain('draft/multiline-concat')
    }
  })

  it('uses the same batch reference tag throughout', () => {
    const { client, sent } = makeClient()
    sendSafeMessage(client, 'srv1', '#general', longContent, ['draft/multiline'])

    const batchOpen = sent[0]!
    const ref = batchOpen.split(' ')[1]!.slice(1) // strip leading '+'
    expect(sent.at(-1)).toBe(`BATCH -${ref}`)
    for (const line of sent.slice(1, -1)) {
      expect(line).toContain(ref)
    }
  })
})

describe('sendSafeMessage — long content without draft/multiline (fallback)', () => {
  const longContent = 'A'.repeat(MAX_IRC_MSG_LENGTH + 100)

  it('sends no BATCH lines', () => {
    const { client, sent } = makeClient()
    sendSafeMessage(client, 'srv1', '#general', longContent, [])
    expect(sent.every((l) => !l.startsWith('BATCH'))).toBe(true)
  })

  it('sends multiple plain PRIVMSGs', () => {
    const { client, sent } = makeClient()
    sendSafeMessage(client, 'srv1', '#general', longContent, [])
    expect(sent.length).toBeGreaterThan(1)
    expect(sent.every((l) => l.startsWith('PRIVMSG #general :'))).toBe(true)
  })
})
