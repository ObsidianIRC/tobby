import React from 'react'
import { TextAttributes } from '@opentui/core'
import { ircColors } from '@irc/ircUtils'
import { stripIrcFormatting } from '@irc/messageFormatter'

export { stripIrcFormatting }

export interface IrcSegment {
  text: string
  fg?: string
  bg?: string
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: IRC control codes
const IRC_CONTROL_RE = /(\x03(?:\d{1,2}(?:,\d{1,2})?)?|[\x02\x1f\x1d\x1e\x11\x0f])/gu

function resolveColor(index: number): string | undefined {
  if (index < 0 || index >= ircColors.length) return undefined
  const color = ircColors[index]
  if (color === 'inherit') return undefined
  return color
}

export function parseIrcFormatting(text: string): IrcSegment[] {
  const segments: IrcSegment[] = []

  let bold = false
  let italic = false
  let underline = false
  let strikethrough = false
  let fg: string | undefined
  let bg: string | undefined

  const parts = text.split(IRC_CONTROL_RE)

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part === '') continue

    if (i % 2 === 0) {
      segments.push({ text: part, fg, bg, bold, italic, underline, strikethrough })
    } else {
      switch (part) {
        case '\x02':
          bold = !bold
          break
        case '\x1d':
          italic = !italic
          break
        case '\x1f':
          underline = !underline
          break
        case '\x1e':
          strikethrough = !strikethrough
          break
        case '\x11':
          // monospace toggle — not representable via TextAttributes bitmask, skip
          break
        case '\x0f':
          bold = false
          italic = false
          underline = false
          strikethrough = false
          fg = undefined
          bg = undefined
          break
        default:
          if (part.startsWith('\x03')) {
            const colorPart = part.slice(1)
            if (colorPart === '') {
              // Bare \x03 resets colors
              fg = undefined
              bg = undefined
            } else {
              const [fgStr, bgStr] = colorPart.split(',')
              fg = resolveColor(Number(fgStr))
              if (bgStr !== undefined) {
                bg = resolveColor(Number(bgStr))
              }
            }
          }
          break
      }
    }
  }

  return segments
}

export function renderIrcText(text: string, keyPrefix?: string): React.ReactNode {
  const segments = parseIrcFormatting(text)

  if (segments.length === 0) return ''
  if (segments.length === 1) {
    const seg = segments[0]
    if (!seg.fg && !seg.bg && !seg.bold && !seg.italic && !seg.underline && !seg.strikethrough) {
      return seg.text
    }
  }

  return segments.map((seg, i) => {
    let attrs = TextAttributes.NONE
    if (seg.bold) attrs |= TextAttributes.BOLD
    if (seg.italic) attrs |= TextAttributes.ITALIC
    if (seg.underline) attrs |= TextAttributes.UNDERLINE
    if (seg.strikethrough) attrs |= TextAttributes.STRIKETHROUGH

    return (
      <span
        key={keyPrefix ? `${keyPrefix}-${i}` : i}
        fg={seg.fg}
        bg={seg.bg}
        attributes={attrs || undefined}
      >
        {seg.text}
      </span>
    )
  })
}
