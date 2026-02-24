import type { Message } from '@/types'

export function msgLineCount(msg: Message, isSelected: boolean, expandMultilines = false): number {
  let h = 1
  if (msg.isMultiline && msg.lines && msg.lines.length > 1) {
    if (isSelected || expandMultilines) {
      h += msg.lines.length - 1
    } else {
      h += Math.min(msg.lines.length - 1, 1)
      if (msg.lines.length > 2) h += 1
    }
  }
  if (msg.replyMessage) h += 1
  if (msg.reactions.length > 0) h += 1
  if (isSelected) h += 1
  return h
}

export function visibleLines(msg: Message, isSelected: boolean): string[] {
  const lines = msg.lines ?? msg.content.split('\n')
  return isSelected ? lines : lines.slice(0, 2)
}

export function hiddenCount(msg: Message): number {
  const lines = msg.lines ?? msg.content.split('\n')
  return lines.length - 2
}
