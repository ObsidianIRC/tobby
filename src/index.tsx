import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { App } from './App'

// Define global variables for ObsidianIRC
declare global {
   
  var __APP_VERSION__: string
}

globalThis.__APP_VERSION__ = '0.1.0'

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
})

createRoot(renderer).render(<App />)
