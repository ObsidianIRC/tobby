#!/usr/bin/env node
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dist = join(__dirname, '..', 'dist', 'index.js')

const hasBun = spawnSync('bun', ['--version'], { stdio: 'pipe' }).status === 0
if (!hasBun) {
  console.error('tobby requires Bun. Install it: https://bun.sh/docs/installation')
  process.exit(1)
}

const result = spawnSync('bun', [dist, ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(result.status ?? 0)
