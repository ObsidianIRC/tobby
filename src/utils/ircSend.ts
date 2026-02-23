/**
 * Safe IRC message sending utilities.
 *
 * IRC limits lines to 512 bytes including \r\n. After accounting for the
 * "PRIVMSG #channel :" prefix, ~450 chars is the conservative safe limit for
 * message content (matching ObsidianIRC's internal splitLongLine default).
 *
 * When a single-line message exceeds this, we split it and either:
 *   - Send a draft/multiline batch with `draft/multiline-concat` tags so
 *     supporting clients display the parts as one continuous message, or
 *   - Fall back to sequential PRIVMSGs when the server lacks draft/multiline.
 */

export const MAX_IRC_MSG_LENGTH = 450

/**
 * Split a long line into chunks that fit within the IRC message size limit.
 * Splits on word boundaries when possible (≥70% of the way through the chunk).
 */
export function splitLongLine(text: string, maxLength = MAX_IRC_MSG_LENGTH): string[] {
  if (text.length <= maxLength) return [text]

  const parts: string[] = []
  let remaining = text

  while (remaining.length > maxLength) {
    let splitIndex = maxLength
    const lastSpace = remaining.lastIndexOf(' ', maxLength)
    if (lastSpace > maxLength * 0.7) {
      splitIndex = lastSpace
    }
    parts.push(remaining.substring(0, splitIndex))
    remaining = remaining.substring(splitIndex).trimStart()
  }

  if (remaining) parts.push(remaining)
  return parts.length > 0 ? parts : [text]
}

interface MinimalClient {
  sendRaw: (serverId: string, line: string) => void
}

/**
 * Send a single-line message safely.
 *
 * If content fits in one IRC line it is sent as a plain PRIVMSG.
 * If it is too long it is split:
 *   - With `draft/multiline` capability: a `BATCH draft/multiline` is opened and
 *     overflow chunks carry `draft/multiline-concat` so receivers display the
 *     parts as one continuous line.
 *   - Without the capability: each chunk is sent as a separate PRIVMSG.
 */
export function sendSafeMessage(
  client: MinimalClient,
  serverId: string,
  target: string,
  content: string,
  capabilities: string[]
): void {
  const parts = splitLongLine(content)

  if (parts.length === 1) {
    client.sendRaw(serverId, `PRIVMSG ${target} :${content}`)
    return
  }

  if (!capabilities.includes('draft/multiline')) {
    for (const part of parts) {
      client.sendRaw(serverId, `PRIVMSG ${target} :${part}`)
    }
    return
  }

  // draft/multiline-concat batch: receivers see the chunks as one message
  const batchId = `ml_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  client.sendRaw(serverId, `BATCH +${batchId} draft/multiline ${target}`)
  for (let i = 0; i < parts.length; i++) {
    const tagPrefix = i === 0 ? `@batch=${batchId}` : `@batch=${batchId};draft/multiline-concat`
    client.sendRaw(serverId, `${tagPrefix} PRIVMSG ${target} :${parts[i]!}`)
  }
  client.sendRaw(serverId, `BATCH -${batchId}`)
}
