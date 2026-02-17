import React from 'react'
import { TextAttributes } from '@opentui/core'
import { ircColors } from '@irc/ircUtils'
import { stripIrcFormatting } from '@irc/messageFormatter'
import { THEME } from '../constants/theme'
import { getNicknameColor } from './nickColors'

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

// eslint-disable-next-line no-control-regex -- IRC formatting uses control codes by design
const IRC_CONTROL_RE = /(\x03(?:\d{1,2}(?:,\d{1,2})?)?|[\x02\x1f\x1d\x1e\x11\x0f])/gu

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
