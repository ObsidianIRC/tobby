import os from 'os'
import path from 'path'
import fs from 'fs'

export function getDataPath(): string {
  const platform = os.platform()
  const home = os.homedir()

  let dataPath: string

  switch (platform) {
    case 'darwin': // macOS
      dataPath = path.join(home, 'Library', 'Application Support', 'ObbyTTY')
      break
    case 'win32': // Windows
      dataPath = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'ObbyTTY')
      break
    default: // Linux and others
      dataPath = path.join(
        process.env.XDG_DATA_HOME || path.join(home, '.local', 'share'),
        'obbytty'
      )
  }

  // Ensure directory exists
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true })
  }

  return dataPath
}

export function getDatabasePath(): string {
  return path.join(getDataPath(), 'obbytty.db')
}

export function resolveDatabasePath(customPath: string): string {
  const resolved = path.resolve(customPath)

  if (fs.existsSync(resolved)) {
    const stat = fs.statSync(resolved)
    if (stat.isDirectory()) {
      return path.join(resolved, 'obbytty.db')
    }
    return resolved
  }

  // Path doesn't exist — decide file vs directory by presence of extension
  if (path.extname(resolved)) {
    // Treat as file: ensure parent directory exists
    const parent = path.dirname(resolved)
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true })
    }
    return resolved
  }

  // No extension — treat as directory
  fs.mkdirSync(resolved, { recursive: true })
  return path.join(resolved, 'obbytty.db')
}
