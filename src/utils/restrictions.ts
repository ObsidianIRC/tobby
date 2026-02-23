declare global {
  var __RESTRICTIONS__: { server?: string; nick?: string } | undefined
}

export function setRestrictions(r: { server?: string; nick?: string }): void {
  globalThis.__RESTRICTIONS__ = r
}

export function getRestrictions(): Readonly<{ server?: string; nick?: string }> {
  return globalThis.__RESTRICTIONS__ ?? {}
}

/**
 * Returns an error string if `host` violates the server restriction, null if allowed.
 * Match is case-insensitive exact hostname comparison.
 */
export function checkServerRestriction(host: string): string | null {
  const server = globalThis.__RESTRICTIONS__?.server
  if (!server) return null
  if (host.toLowerCase() !== server.toLowerCase()) {
    return `Server restricted to: ${server}`
  }
  return null
}

/**
 * Returns an error string if `nick` violates the nick restriction, null if allowed.
 * Trailing underscores are stripped before comparing — the server may append them
 * automatically on nick collision, which is acceptable.
 */
export function checkNickRestriction(nick: string): string | null {
  const restricted = globalThis.__RESTRICTIONS__?.nick
  if (!restricted) return null
  const base = nick.replace(/_+$/, '').toLowerCase()
  const r = restricted.replace(/_+$/, '').toLowerCase()
  if (base !== r) {
    return `Nick restricted to: ${restricted}`
  }
  return null
}
