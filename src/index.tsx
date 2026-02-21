import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { App } from './App'
import fs from 'node:fs'
import os from 'node:os'
import { resolveDatabasePath } from './utils/paths'
import { setDatabasePath } from './services/database'
import { bootstrapServer } from './utils/bootstrapServer'

declare global {
  var __APP_VERSION__: string
  var debugLog: ((...args: any[]) => void) | undefined
  // Set when --setup flag is given; tells App to open the connect modal on launch.
  var __SETUP_MODE__: boolean
  // CLI-provided prefill values forwarded to the connect modal.
  var __CLI_PREFILL__:
    | { host?: string; port?: number; nick?: string; ssl?: boolean; channels?: string[] }
    | undefined
}

globalThis.__APP_VERSION__ = '0.1.0'

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

  --debug            Write a debug log to tobby-debug.log.
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
        result.port = parseInt(args[++i], 10)
        break
      case '--nick':
        result.nick = args[++i]
        break
      case '--ssl':
        result.ssl = true
        break
      case '--channel':
        result.channels.push(args[++i])
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
