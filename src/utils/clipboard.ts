import { spawnSync } from 'child_process'
import clipboard from 'clipboardy'

function writePlatformClipboard(text: string): boolean {
  let cmd: string
  let args: string[]

  if (process.platform === 'darwin') {
    cmd = 'pbcopy'
    args = []
  } else if (process.platform === 'linux') {
    if (process.env.WAYLAND_DISPLAY) {
      cmd = 'wl-copy'
      args = []
    } else {
      cmd = 'xclip'
      args = ['-selection', 'clipboard']
    }
  } else {
    return false
  }

  const result = spawnSync(cmd, args, { input: text })
  return result.status === 0
}

function writeOSC52(text: string): void {
  const base64 = Buffer.from(text).toString('base64')
  if (process.env.TMUX) {
    process.stderr.write(`\x1bPtmux;\x1b\x1b]52;c;${base64}\x07\x1b\\`)
  } else {
    process.stderr.write(`\x1b]52;c;${base64}\x07`)
  }
}

export function copyToClipboard(text: string): boolean {
  // Platform tools first — they reliably write to system clipboard
  try {
    if (writePlatformClipboard(text)) return true
  } catch {
    // Fall through
  }

  // clipboardy as second fallback
  try {
    clipboard.writeSync(text)
    return true
  } catch {
    // Fall through
  }

  // OSC 52 last resort (for remote/SSH sessions)
  try {
    writeOSC52(text)
    return true
  } catch {
    return false
  }
}
