import { test, expect, describe } from 'bun:test'
import { parseIrcFormatting } from '../../../src/utils/ircFormatting'

describe('parseIrcFormatting', () => {
  test('plain text returns single segment with no formatting', () => {
    const result = parseIrcFormatting('Hello')
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('Hello')
    expect(result[0].fg).toBeUndefined()
    expect(result[0].bg).toBeUndefined()
    expect(result[0].bold).toBe(false)
    expect(result[0].italic).toBe(false)
    expect(result[0].underline).toBe(false)
    expect(result[0].strikethrough).toBe(false)
  })

  test('empty string returns no segments', () => {
    const result = parseIrcFormatting('')
    expect(result).toHaveLength(0)
  })

  test('single fg color', () => {
    const result = parseIrcFormatting('\x034Hello')
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('Hello')
    expect(result[0].fg).toBe('#FF0000')
  })

  test('fg + bg color', () => {
    const result = parseIrcFormatting('\x034,2Hello')
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('Hello')
    expect(result[0].fg).toBe('#FF0000')
    expect(result[0].bg).toBe('#00007F')
  })

  test('two-digit color code', () => {
    const result = parseIrcFormatting('\x0312Hello')
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('Hello')
    expect(result[0].fg).toBe('#0000FC')
  })

  test('bold toggle', () => {
    const result = parseIrcFormatting('\x02bold\x02normal')
    expect(result).toHaveLength(2)
    expect(result[0].text).toBe('bold')
    expect(result[0].bold).toBe(true)
    expect(result[1].text).toBe('normal')
    expect(result[1].bold).toBe(false)
  })

  test('italic toggle', () => {
    const result = parseIrcFormatting('\x1Ditalic\x1Dnormal')
    expect(result).toHaveLength(2)
    expect(result[0].text).toBe('italic')
    expect(result[0].italic).toBe(true)
    expect(result[1].text).toBe('normal')
    expect(result[1].italic).toBe(false)
  })

  test('underline toggle', () => {
    const result = parseIrcFormatting('\x1Funder\x1Fnormal')
    expect(result).toHaveLength(2)
    expect(result[0].text).toBe('under')
    expect(result[0].underline).toBe(true)
    expect(result[1].text).toBe('normal')
    expect(result[1].underline).toBe(false)
  })

  test('strikethrough toggle', () => {
    const result = parseIrcFormatting('\x1Estrike\x1Enormal')
    expect(result).toHaveLength(2)
    expect(result[0].text).toBe('strike')
    expect(result[0].strikethrough).toBe(true)
    expect(result[1].text).toBe('normal')
    expect(result[1].strikethrough).toBe(false)
  })

  test('reset clears all formatting', () => {
    const result = parseIrcFormatting('\x02\x034bold-red\x0Fnormal')
    expect(result).toHaveLength(2)
    expect(result[0].text).toBe('bold-red')
    expect(result[0].bold).toBe(true)
    expect(result[0].fg).toBe('#FF0000')
    expect(result[1].text).toBe('normal')
    expect(result[1].bold).toBe(false)
    expect(result[1].fg).toBeUndefined()
  })

  test('nested bold + italic', () => {
    const result = parseIrcFormatting('\x02\x1Dbold-italic\x1D\x02')
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('bold-italic')
    expect(result[0].bold).toBe(true)
    expect(result[0].italic).toBe(true)
  })

  test('bare \\x03 resets colors', () => {
    const result = parseIrcFormatting('\x034red\x03default')
    expect(result).toHaveLength(2)
    expect(result[0].text).toBe('red')
    expect(result[0].fg).toBe('#FF0000')
    expect(result[1].text).toBe('default')
    expect(result[1].fg).toBeUndefined()
  })

  test('multiple color changes', () => {
    const result = parseIrcFormatting('\x034red\x039green\x0312blue')
    expect(result).toHaveLength(3)
    expect(result[0].text).toBe('red')
    expect(result[0].fg).toBe('#FF0000')
    expect(result[1].text).toBe('green')
    expect(result[1].fg).toBe('#00FC00')
    expect(result[2].text).toBe('blue')
    expect(result[2].fg).toBe('#0000FC')
  })

  test('control code at end produces no extra segment', () => {
    const result = parseIrcFormatting('text\x02')
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('text')
    expect(result[0].bold).toBe(false)
  })

  test('color index 99 (inherit) resolves to undefined', () => {
    const result = parseIrcFormatting('\x0399Hello')
    expect(result).toHaveLength(1)
    expect(result[0].fg).toBeUndefined()
  })
})
