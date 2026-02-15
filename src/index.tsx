import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { App } from './App'
import fs from 'node:fs'

// Define global variables for ObsidianIRC
declare global {
  var __APP_VERSION__: string
  var debugLog: ((...args: any[]) => void) | undefined
}

globalThis.__APP_VERSION__ = '0.1.0'

// Simple debug logging that doesn't interfere with console
const isDebug = process.argv.includes('--debug')
if (isDebug) {
  const logStream = fs.createWriteStream('obbytty-debug.log', { flags: 'a' })
  globalThis.debugLog = (...args: any[]) => {
    const timestamp = new Date().toISOString()
    const message = args
      .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
      .join(' ')
    logStream.write(`[${timestamp}] ${message}\n`)
  }
  debugLog!('Debug mode enabled')
} else {
  globalThis.debugLog = undefined
}

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
})

createRoot(renderer).render(<App />)
