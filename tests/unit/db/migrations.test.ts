import { describe, it, expect, beforeEach, vi } from 'vitest'

// Each test needs a fresh database instance, so we reset the singleton and
// provide a custom mock that tracks what was stored in user_version.
describe('DB migrations', () => {
  beforeEach(async () => {
    vi.resetModules()
  })

  it('fresh DB initializes to user_version 101 and ui_state is readable', async () => {
    // Track PRAGMA user_version state across run() and query() calls
    let storedVersion = 0
    const ranSqls: string[] = []

    vi.doMock('bun:sqlite', () => ({
      Database: class {
        run(sql: string) {
          ranSqls.push(sql.trim())
          const m = sql.match(/PRAGMA user_version\s*=\s*(\d+)/i)
          if (m) storedVersion = parseInt(m[1]!, 10)
        }
        query(sql: string) {
          const s = sql.toLowerCase().trim()
          if (s.includes('pragma user_version')) {
            return { get: () => ({ user_version: storedVersion }), all: () => [] }
          }
          if (s.includes('select * from ui_state')) {
            return {
              get: () => ({ id: 1, show_server_pane: 1, show_user_pane: 1, show_timestamps: 1 }),
              all: () => [],
            }
          }
          return { get: () => null, all: () => [] }
        }
        close() {}
      },
    }))

    const { getDatabase, closeDatabase } = await import('@/services/database')
    closeDatabase()
    const db = getDatabase()

    // Migration 101 should have been applied
    expect(storedVersion).toBe(101)

    // ui_state table should be readable
    const uiState = db.getUIState()
    expect(uiState).not.toBeNull()
    expect(uiState!.showServerPane).toBe(true)
    expect(uiState!.showUserPane).toBe(true)
    expect(uiState!.showTimestamps).toBe(true)

    closeDatabase()
  })

  it('DB at v1.0 (user_version=100) is migrated to 101', async () => {
    let storedVersion = 100

    vi.doMock('bun:sqlite', () => ({
      Database: class {
        run(sql: string) {
          const m = sql.match(/PRAGMA user_version\s*=\s*(\d+)/i)
          if (m) storedVersion = parseInt(m[1]!, 10)
        }
        query(sql: string) {
          const s = sql.toLowerCase().trim()
          if (s.includes('pragma user_version')) {
            return { get: () => ({ user_version: storedVersion }), all: () => [] }
          }
          return { get: () => null, all: () => [] }
        }
        close() {}
      },
    }))

    const { getDatabase, closeDatabase } = await import('@/services/database')
    closeDatabase()
    getDatabase()

    expect(storedVersion).toBe(101)
    closeDatabase()
  })

  it('DB from a newer major version (user_version=200) throws upgrade error', async () => {
    vi.doMock('bun:sqlite', () => ({
      Database: class {
        run() {}
        query(sql: string) {
          if (sql.toLowerCase().includes('pragma user_version')) {
            return { get: () => ({ user_version: 200 }), all: () => [] }
          }
          return { get: () => null, all: () => [] }
        }
        close() {}
      },
    }))

    const { getDatabase, closeDatabase } = await import('@/services/database')
    closeDatabase()

    expect(() => getDatabase()).toThrow(/newer version of tobby/)
    closeDatabase()
  })
})
