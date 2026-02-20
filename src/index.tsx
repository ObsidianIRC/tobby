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
}

globalThis.__APP_VERSION__ = '0.1.0'

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
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = { ssl: false, channels: [], debug: false }
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

// ── Bootstrap server from CLI flags ──────────────────────────────────────────

if (parsed.server) {
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
