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
