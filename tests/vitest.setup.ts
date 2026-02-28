import { vi } from 'vitest'

globalThis.__APP_VERSION__ = '0.1.0-test'

vi.mock('bun:sqlite', () => ({
  Database: class {
    run() {}
    query(sql: string) {
      // PRAGMA user_version must return a row (SQLite always does)
      if (typeof sql === 'string' && sql.toLowerCase().includes('pragma user_version')) {
        return { get: () => ({ user_version: 0 }), all: () => [] }
      }
      return { get: () => null, all: () => [] }
    }
    close() {}
  },
}))

vi.mock('@opentui/core', () => ({
  TextAttributes: {
    NONE: 0,
    BOLD: 1 << 0,
    DIM: 1 << 1,
    ITALIC: 1 << 2,
    UNDERLINE: 1 << 3,
    BLINK: 1 << 4,
    INVERSE: 1 << 5,
    HIDDEN: 1 << 6,
    STRIKETHROUGH: 1 << 7,
  },
  MacOSScrollAccel: class {
    constructor() {}
  },
}))
