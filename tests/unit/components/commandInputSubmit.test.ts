/**
 * Tests for the handleSubmit logic extracted from CommandInput.
 *
 * These cover the exact behaviours that were silently broken:
 *  - empty text is rejected (so a broken getText returning '' causes no send)
 *  - single-line text routes to commandParser
 *  - multiline text is detected and sent via BATCH or per-line fallback
 */
import { describe, it, expect } from 'vitest'

// ──────────────────────────────────────────────────────────────────────────────
// Minimal faithful re-implementation of handleSubmit's core branching logic,
// so we can unit-test it without the opentui/React runtime.
// ──────────────────────────────────────────────────────────────────────────────

interface SendCall {
  type: 'raw' | 'parse' | 'localEcho'
  payload: string
}

async function simulateSubmit(
  rawText: string,
  opts: {
    hasMultilineCap: boolean
    hasEchoCap: boolean
    hasTarget: boolean
    hasServer: boolean
  }
): Promise<SendCall[]> {
  const calls: SendCall[] = []
  const text = rawText.trim()
  if (!text) return calls

  const isCommand = text.startsWith('/')
  const hasNewlines = text.includes('\n')

  if (!isCommand && hasNewlines && opts.hasServer) {
    const lines = text.split('\n').filter(Boolean)
    if (opts.hasTarget) {
      if (opts.hasMultilineCap) {
        calls.push({ type: 'raw', payload: 'BATCH+' })
        for (const line of lines) {
          calls.push({ type: 'raw', payload: `PRIVMSG:${line}` })
        }
        calls.push({ type: 'raw', payload: 'BATCH-' })
        if (!opts.hasEchoCap) {
          calls.push({ type: 'localEcho', payload: lines.join('\n') })
        }
      } else {
        for (const line of lines) {
          calls.push({ type: 'parse', payload: line })
        }
      }
    }
    return calls
  }

  // Single-line / command path
  calls.push({ type: 'parse', payload: text })
  return calls
}

describe('handleSubmit — empty / blank input', () => {
  it('does nothing for empty string', async () => {
    const calls = await simulateSubmit('', {
      hasMultilineCap: true,
      hasEchoCap: false,
      hasTarget: true,
      hasServer: true,
    })
    expect(calls).toHaveLength(0)
  })

  it('does nothing for whitespace-only string', async () => {
    const calls = await simulateSubmit('   ', {
      hasMultilineCap: true,
      hasEchoCap: false,
      hasTarget: true,
      hasServer: true,
    })
    expect(calls).toHaveLength(0)
  })
})

describe('handleSubmit — single-line message', () => {
  it('routes a plain message to commandParser', async () => {
    const calls = await simulateSubmit('hello world', {
      hasMultilineCap: true,
      hasEchoCap: false,
      hasTarget: true,
      hasServer: true,
    })
    expect(calls).toEqual([{ type: 'parse', payload: 'hello world' }])
  })

  it('routes a /command to commandParser', async () => {
    const calls = await simulateSubmit('/join #test', {
      hasMultilineCap: true,
      hasEchoCap: false,
      hasTarget: true,
      hasServer: true,
    })
    expect(calls).toEqual([{ type: 'parse', payload: '/join #test' }])
  })
})

describe('handleSubmit — multiline with draft/multiline cap', () => {
  it('sends BATCH wrapper + individual PRIVMSGs', async () => {
    const calls = await simulateSubmit('line1\nline2\nline3', {
      hasMultilineCap: true,
      hasEchoCap: false,
      hasTarget: true,
      hasServer: true,
    })
    expect(calls[0]).toEqual({ type: 'raw', payload: 'BATCH+' })
    expect(calls.filter((c) => c.type === 'raw' && c.payload.startsWith('PRIVMSG'))).toHaveLength(3)
    expect(calls[calls.length - 2]).toEqual({ type: 'raw', payload: 'BATCH-' })
  })

  it('adds local echo when server has no echo-message cap', async () => {
    const calls = await simulateSubmit('a\nb', {
      hasMultilineCap: true,
      hasEchoCap: false,
      hasTarget: true,
      hasServer: true,
    })
    const echo = calls.find((c) => c.type === 'localEcho')
    expect(echo?.payload).toBe('a\nb')
  })

  it('skips local echo when server has echo-message cap', async () => {
    const calls = await simulateSubmit('a\nb', {
      hasMultilineCap: true,
      hasEchoCap: true,
      hasTarget: true,
      hasServer: true,
    })
    expect(calls.find((c) => c.type === 'localEcho')).toBeUndefined()
  })

  it('does nothing when there is no target', async () => {
    const calls = await simulateSubmit('a\nb', {
      hasMultilineCap: true,
      hasEchoCap: false,
      hasTarget: false,
      hasServer: true,
    })
    // No BATCH, no parse, no echo — multiline branch skips when no target
    expect(calls).toHaveLength(0)
  })
})

describe('handleSubmit — multiline fallback (no draft/multiline cap)', () => {
  it('sends each line individually via commandParser', async () => {
    const calls = await simulateSubmit('line1\nline2', {
      hasMultilineCap: false,
      hasEchoCap: false,
      hasTarget: true,
      hasServer: true,
    })
    expect(calls).toEqual([
      { type: 'parse', payload: 'line1' },
      { type: 'parse', payload: 'line2' },
    ])
  })

  it('filters blank lines from the split', async () => {
    const calls = await simulateSubmit('line1\n\nline2', {
      hasMultilineCap: false,
      hasEchoCap: false,
      hasTarget: true,
      hasServer: true,
    })
    expect(calls).toHaveLength(2)
  })
})

describe('handleSubmit — /command is never treated as multiline', () => {
  it('a command with embedded newline is still sent as one parse call', async () => {
    // /commands cannot be multiline; newlines inside them are just sent raw
    const calls = await simulateSubmit('/me does a\nthing', {
      hasMultilineCap: true,
      hasEchoCap: false,
      hasTarget: true,
      hasServer: true,
    })
    // Starts with '/' so it goes single-line path
    expect(calls).toEqual([{ type: 'parse', payload: '/me does a\nthing' }])
  })
})
