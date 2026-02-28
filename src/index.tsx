import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { App } from './App'
import fs from 'node:fs'
import os from 'node:os'
import { resolveDatabasePath } from './utils/paths'
import { setDatabasePath } from './services/database'
import { bootstrapServer } from './utils/bootstrapServer'
import { setRestrictions } from './utils/restrictions'
import pkg from '../package.json'

declare global {
  var __APP_VERSION__: string
  // Injected at build time via --define; undefined in dev mode (runtime fallback used instead).
  var __GIT_COMMIT__: string | undefined
  var debugLog: ((...args: any[]) => void) | undefined
  // Set when --setup flag is given; tells App to open the connect modal on launch.
  var __SETUP_MODE__: boolean
  // CLI-provided prefill values forwarded to the connect modal.
  var __CLI_PREFILL__:
    | { host?: string; port?: number; nick?: string; ssl?: boolean; channels?: string[] }
    | undefined
}

globalThis.__APP_VERSION__ = '0.1.0'

// ── Fix Bun.stringWidth for ZWJ emoji sequences ───────────────────────────────
// Bun.stringWidth counts each component of a ZWJ sequence separately
// (e.g. 😵‍💫 = 😵 + U+200D + 💫 → width 4). Whether that matches the terminal's
// actual rendering depends on the terminal:
//
//   • iTerm2 (and most modern terminals): combines ZWJ sequences into a single
//     2-column glyph  → Bun says 4, terminal uses 2 → bleed without this patch
//   • Kitty: renders ZWJ components individually (4 columns total)
//     → Bun says 4, terminal uses 4 → already correct, patch would break it
//
// Detect Kitty via its environment variables and skip the patch there.
const _isKitty = process.env.KITTY_WINDOW_ID !== undefined || process.env.TERM === 'xterm-kitty'

if (!_isKitty) {
  const _origStringWidth = Bun.stringWidth
  const _graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  Bun.stringWidth = (str: string) => {
    // Fast path: no ZWJ → original handles everything (including ANSI stripping)
    if (!str.includes('\u200D')) return _origStringWidth(str)
    // Walk grapheme clusters. For ZWJ clusters return 2; measure surrounding
    // text runs with the original so ANSI escape sequences are handled correctly.
    let width = 0
    let tail = 0
    for (const { segment, index } of _graphemeSegmenter.segment(str)) {
      if (segment.includes('\u200D')) {
        if (index > tail) width += _origStringWidth(str.slice(tail, index))
        width += 2
        tail = index + segment.length
      }
    }
    if (tail < str.length) width += _origStringWidth(str.slice(tail))
    return width
  }
}

// ── Suppress ObsidianIRC reconnect noise from the opentui console panel ─────
// These messages are expected operational events already surfaced in the server
// buffer. Keeping them out of the error console reduces false-alarm popups.
const _origLog = console.log
const _origWarn = console.warn
const IRC_NOISE = [
  'Starting CAP negotiation',
  'Starting reconnection for server',
  'Reconnection successful for server',
  'Reconnection failed for server',
  'rate-limited',
  'WebSocket ping timeout',
]
console.log = (...args: unknown[]) => {
  const msg = args.map(String).join(' ')
  if (IRC_NOISE.some((p) => msg.includes(p))) {
    debugLog?.('[irc-noise]', msg)
    return
  }
  _origLog(...args)
}
console.warn = (...args: unknown[]) => {
  const msg = args.map(String).join(' ')
  if (IRC_NOISE.some((p) => msg.includes(p))) {
    debugLog?.('[irc-noise]', msg)
    return
  }
  _origWarn(...args)
}

// ── Argument parsing ────────────────────────────────────────────────────────

const argv = process.argv.slice(2)

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(
    `
tobby — a terminal IRC client

Usage:
  tobby [options]

Options:
  --db <path>        Database file or directory.
                     Existing file  → used directly.
                     Existing dir   → looks for obbytty.db inside.
                     New path + ext → created as a file (parent dir auto-created).
                     New path w/o ext → created as a directory with obbytty.db.

  --server <host>    IRC server hostname. Saved to the database if not present.
  --port <port>      IRC server port (default: 6667, or 6697 with --ssl).
  --nick <nick>      Nickname (default: system username).
  --ssl              Connect with SSL/TLS.
  --channel <name>   Channel to auto-join, e.g. '#linux'. Repeatable.

  --setup            Open the server setup dialog on launch (prefilled with
                     --server/--port/--nick if provided). Connects only after
                     you submit the form, so you can fill in a password etc.
  --setup-if-not-configured
                     Like --setup, but skips the dialog if the server
                     (matched by host+port, or any server when --server is
                     omitted) is already saved in the database.

  --restrict-server <host>
                     Only allow connecting to the given hostname. Any attempt
                     to connect to a different server (via dialog or /connect)
                     will be rejected with an error.
  --restrict-user <nick>
                     Only allow using the given nickname. Trailing underscores
                     are permitted (server may append them on collision).

  --debug            Write a debug log to tobby-debug.log.
  --version, -v      Print version and exit.
  --help, -h         Show this help and exit.

Examples:
  tobby
  tobby --db ~/.config/tobby/
  tobby --db ~/irc.db
  tobby --server irc.libera.chat --nick mynick --ssl
  tobby --server irc.libera.chat --port 6697 --ssl --nick mynick
  tobby --server irc.libera.chat --nick me --channel '#linux' --channel '#bots'
`.trimStart()
  )
  process.exit(0)
}

if (argv.includes('--version') || argv.includes('-v')) {
  // In built binaries __GIT_COMMIT__ is replaced by --define at compile time.
  // In dev mode (bun run src/index.tsx) fall back to a runtime git call.
  let gitHash: string
  if (typeof __GIT_COMMIT__ !== 'undefined') {
    gitHash = __GIT_COMMIT__
  } else {
    try {
      const r = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD'], {
        cwd: new URL('..', import.meta.url).pathname,
      })
      gitHash = r.success ? r.stdout.toString().trim() : 'unknown'
    } catch {
      gitHash = 'unknown'
    }
  }
  console.log(`tobby ${pkg.version} (${gitHash})`)
  process.exit(0)
}

interface ParsedArgs {
  db?: string
  server?: string
  port?: number
  nick?: string
  ssl: boolean
  channels: string[]
  debug: boolean
  setup: boolean
  setupIfNotConfigured: boolean
  restrictServer?: string
  restrictUser?: string
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    ssl: false,
    channels: [],
    debug: false,
    setup: false,
    setupIfNotConfigured: false,
  }
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--db':
        result.db = args[++i]
        break
      case '--server':
        result.server = args[++i]
        break
      case '--port':
        result.port = parseInt(args[++i]!, 10)
        break
      case '--nick':
        result.nick = args[++i]!
        break
      case '--ssl':
        result.ssl = true
        break
      case '--channel':
        result.channels.push(args[++i]!)
        break
      case '--debug':
        result.debug = true
        break
      case '--setup':
        result.setup = true
        break
      case '--setup-if-not-configured':
        result.setupIfNotConfigured = true
        break
      case '--restrict-server':
        result.restrictServer = args[++i]
        break
      case '--restrict-user':
        result.restrictUser = args[++i]
        break
    }
  }
  return result
}

const parsed = parseArgs(argv)

// ── Debug logging ────────────────────────────────────────────────────────────

if (parsed.debug) {
  const logStream = fs.createWriteStream('tobby-debug.log', { flags: 'a' })
  globalThis.debugLog = (...args: any[]) => {
    const timestamp = new Date().toISOString()
    const message = args
      .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ')
    logStream.write(`[${timestamp}] ${message}\n`)
  }
  debugLog!('Debug mode enabled')
} else {
  globalThis.debugLog = undefined
}

// ── Connection restrictions ───────────────────────────────────────────────────

setRestrictions({ server: parsed.restrictServer, nick: parsed.restrictUser })

// ── Database path ─────────────────────────────────────────────────────────────

if (parsed.db) {
  setDatabasePath(resolveDatabasePath(parsed.db))
}

// ── Setup mode globals ────────────────────────────────────────────────────────

let wantsSetup = parsed.setup

if (parsed.setupIfNotConfigured) {
  // Open the modal only when the target server isn't in the DB yet.
  const { getDatabase } = await import('./services/database')
  const allServers = getDatabase().getAllServers()
  const alreadyConfigured = parsed.server
    ? allServers.some(
        (s) => s.host === parsed.server && s.port === (parsed.port ?? (parsed.ssl ? 6697 : 6667))
      )
    : allServers.length > 0
  wantsSetup = !alreadyConfigured
}

globalThis.__SETUP_MODE__ = wantsSetup
globalThis.__CLI_PREFILL__ = wantsSetup
  ? {
      host: parsed.server,
      port: parsed.port ?? (parsed.ssl ? 6697 : 6667),
      nick: parsed.nick,
      ssl: parsed.ssl,
      channels: parsed.channels.length > 0 ? parsed.channels : undefined,
    }
  : undefined

// ── Bootstrap server from CLI flags ──────────────────────────────────────────

// --setup / --setup-if-not-configured skip auto-bootstrap; connection happens
// after the user submits the connect modal.
if (parsed.server && !wantsSetup) {
  const defaultPort = parsed.ssl ? 6697 : 6667
  bootstrapServer({
    host: parsed.server,
    port: parsed.port ?? defaultPort,
    nick: parsed.nick ?? os.userInfo().username,
    ssl: parsed.ssl,
    channels: parsed.channels,
  })
}

// ── Launch app ────────────────────────────────────────────────────────────────

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
})

createRoot(renderer).render(<App />)
