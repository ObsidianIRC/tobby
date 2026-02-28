import React from 'react'
import { TextAttributes } from '@opentui/core'
import { ircColors } from '@irc/ircUtils'
import { stripIrcFormatting } from '@irc/messageFormatter'
import { THEME } from '../constants/theme'
import { getNicknameColor } from './nickColors'

export { stripIrcFormatting }

interface IrcSegment {
  text: string
  fg?: string
  bg?: string
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
}

// eslint-disable-next-line no-control-regex -- IRC formatting uses control codes by design
const IRC_CONTROL_RE = /(\x03(?:\d{1,2}(?:,\d{1,2})?)?|[\x02\x1f\x1d\x1e\x16\x11\x0f])/gu

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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
      segments.push({ text: part!, fg, bg, bold, italic, underline, strikethrough })
    } else {
      switch (part!) {
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
        case '\x16':
          // reverse video — not rendered, just consumed
          break
        case '\x11':
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
          if (part!.startsWith('\x03')) {
            const colorPart = part!.slice(1)
            if (colorPart === '') {
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

// Splits a text segment by the set of known nicks using word boundaries.
// Returns alternating [plainText, nick, plainText, nick, ...] parts.
function splitByNicks(text: string, nickPattern: RegExp): string[] {
  return text.split(nickPattern)
}

export function renderIrcText(
  text: string,
  keyPrefix?: string,
  // Our own nickname — highlighted with mention style (background + color)
  nickname?: string,
  // All channel members — colored with their consistent nick color
  channelUsers?: string[]
): React.ReactNode {
  const segments = parseIrcFormatting(text)

  if (segments.length === 0) return ''

  // Build a combined nick pattern if we have any nicks to color
  const allNicks: string[] = []
  if (nickname) allNicks.push(nickname)
  if (channelUsers) {
    for (const u of channelUsers) {
      if (!nickname || u.toLowerCase() !== nickname.toLowerCase()) allNicks.push(u)
    }
  }

  // Fast path: no nick coloring needed, single plain segment
  if (segments.length === 1 && allNicks.length === 0) {
    const seg = segments[0]!
    if (!seg.fg && !seg.bg && !seg.bold && !seg.italic && !seg.underline && !seg.strikethrough) {
      return seg.text
    }
  }

  const nickPattern =
    allNicks.length > 0
      ? new RegExp(`(\\b(?:${allNicks.map(escapeRegExp).join('|')})\\b)`, 'gi')
      : null

  const elements: React.ReactNode[] = []
  let key = 0

  for (const seg of segments) {
    let attrs = TextAttributes.NONE
    if (seg.bold) attrs |= TextAttributes.BOLD
    if (seg.italic) attrs |= TextAttributes.ITALIC
    if (seg.underline) attrs |= TextAttributes.UNDERLINE
    if (seg.strikethrough) attrs |= TextAttributes.STRIKETHROUGH

    if (nickPattern) {
      // split() with a capture group puts the captured (nick) parts at odd indices
      const parts = splitByNicks(seg.text, nickPattern)
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (!part) continue
        const k = keyPrefix ? `${keyPrefix}-${key}` : key
        key++

        const isNickPart = i % 2 === 1
        if (isNickPart) {
          const isOwnNick = nickname && part.toLowerCase() === nickname.toLowerCase()
          if (isOwnNick) {
            elements.push(
              <span
                key={k}
                fg={THEME.mention}
                bg={THEME.backgroundMention}
                attributes={attrs || undefined}
              >
                {part}
              </span>
            )
          } else {
            // Other channel member — use their consistent nick color, keep IRC bg if any
            elements.push(
              <span key={k} fg={getNicknameColor(part)} bg={seg.bg} attributes={attrs || undefined}>
                {part}
              </span>
            )
          }
        } else {
          elements.push(
            <span key={k} fg={seg.fg} bg={seg.bg} attributes={attrs || undefined}>
              {part}
            </span>
          )
        }
      }
    } else {
      const k = keyPrefix ? `${keyPrefix}-${key}` : key
      key++
      elements.push(
        <span key={k} fg={seg.fg} bg={seg.bg} attributes={attrs || undefined}>
          {seg.text}
        </span>
      )
    }
  }

  return elements
}

// eslint-disable-next-line no-control-regex -- same set as stripIrcFormatting
const STRIP_RE_SRC = /\x03\d{0,2}(?:,\d{0,2})?|[\x02\x1d\x1f\x1e\x16\x11\x0f]/gi

// Word-wrap `text` at `maxWidth` visual columns.
function wordWrap(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0 || text.length <= maxWidth) return [text]
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (!current) {
      current = word
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += ' ' + word
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : [text]
}

/**
 * IRC-aware word wrap. Returns substrings of `content` (with IRC codes
 * preserved) whose *visual* text fits within `maxWidth` characters —
 * the same line-break positions as `wordWrap(stripIrcFormatting(content), maxWidth)`.
 */
export function ircWordWrap(content: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [content]
  const plain = stripIrcFormatting(content)
  if (plain.length <= maxWidth) return [content]

  const plainLines = wordWrap(plain, maxWidth)
  if (plainLines.length <= 1) return [content]

  // Build visToRaw: maps each visual-char index to its raw byte position in content.
  const visToRaw: number[] = []
  let rawIdx = 0
  const re = new RegExp(STRIP_RE_SRC.source, 'gi')
  while (rawIdx < content.length) {
    re.lastIndex = rawIdx
    const m = re.exec(content)
    if (m && m.index === rawIdx) {
      rawIdx += m[0].length
    } else {
      visToRaw.push(rawIdx)
      rawIdx++
    }
  }

  const result: string[] = []
  let visOffset = 0
  for (let i = 0; i < plainLines.length; i++) {
    const lineLen = plainLines[i]!.length
    const visEnd = visOffset + lineLen
    // For the first line include any leading IRC codes (rawStart = 0).
    // For subsequent lines start just after the separating space.
    const rawStart = i === 0 ? 0 : visToRaw[visOffset - 1]! + 1
    const rawEnd = visEnd < visToRaw.length ? visToRaw[visEnd]! : content.length
    result.push(content.slice(rawStart, rawEnd))
    visOffset = visEnd + 1 // +1 to skip the separating space
  }

  return result.length > 0 ? result : [content]
}
