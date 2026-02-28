import { Database } from 'bun:sqlite'
import { getDatabasePath } from '../utils/paths'
import type { Server, Channel } from '../types'

interface PersistedServer {
  id: string
  name: string
  host: string
  port: number
  ssl: boolean
  nickname: string
  username?: string
  realname?: string
  password?: string
  sasl_account?: string
  sasl_password?: string
  auto_connect: boolean
  created_at: number
  updated_at: number
}

interface PersistedChannel {
  id: string
  server_id: string
  name: string
  auto_join: boolean
  created_at: number
}

interface PersistedUIState {
  showServerPane: boolean
  showUserPane: boolean
  showTimestamps: boolean
}

let _customDbPath: string | null = null

export function setDatabasePath(p: string): void {
  _customDbPath = p
}

class DatabaseService {
  private db: Database

  constructor() {
    const dbPath = _customDbPath ?? getDatabasePath()
    this.db = new Database(dbPath)
    this.initialize()
  }

  private initialize() {
    this.db.run('PRAGMA foreign_keys = ON')

    // ─── Schema version policy (stored in PRAGMA user_version) ───────────────
    // Encoding: MAJOR * 100 + MINOR  (e.g. v1.1 = 101)
    //
    // Minor versions (same MAJOR) are always backwards-compatible:
    //   only additive changes (new tables, new nullable/default columns).
    //   An old app can read a newer-minor DB safely.
    //
    // Major version bumps are BREAKING — an old app cannot correctly read
    //   a DB created by a newer major version and must refuse to open it.
    // ─────────────────────────────────────────────────────────────────────────
    const SCHEMA_VERSION = 101 // v1.1

    const rawVersion = this.db.query('PRAGMA user_version').get() as { user_version: number }
    // treat 0 as v1.0 baseline (pre-versioning databases)
    const dbVersion = rawVersion.user_version === 0 ? 100 : rawVersion.user_version

    const schemaMajor = Math.floor(SCHEMA_VERSION / 100)
    const dbMajor = Math.floor(dbVersion / 100)
    if (dbMajor > schemaMajor) {
      throw new Error(
        `Database was created by a newer version of tobby (DB schema v${dbMajor}.x). ` +
          `Please upgrade tobby to continue.`
      )
    }

    // Baseline tables (always created idempotently)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        ssl INTEGER DEFAULT 0,
        nickname TEXT NOT NULL,
        username TEXT,
        realname TEXT,
        password TEXT,
        sasl_account TEXT,
        sasl_password TEXT,
        auto_connect INTEGER DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        name TEXT NOT NULL,
        auto_join INTEGER DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
      )
    `)

    // Keep sort_order try-catch migrations for pre-v1.0 databases that may lack the column
    try {
      this.db.run('ALTER TABLE servers ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0')
    } catch {
      // column already present
    }
    try {
      this.db.run('ALTER TABLE channels ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0')
    } catch {
      // column already present
    }

    this.db.run(`
      CREATE TABLE IF NOT EXISTS server_state (
        server_id TEXT PRIMARY KEY,
        current_nickname TEXT,
        connection_state TEXT,
        last_connected INTEGER,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
      )
    `)

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_channels_server_id
      ON channels(server_id)
    `)

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_servers_auto_connect
      ON servers(auto_connect)
    `)

    this.runMigrations(dbVersion, SCHEMA_VERSION)
  }

  private runMigrations(from: number, to: number) {
    const migrations: Array<[number, () => void]> = [
      [101, () => this.migrate_101()],
      // Future: [102, () => this.migrate_102()], ...
    ]
    for (const [version, run] of migrations) {
      if (from < version && version <= to) {
        run()
        this.db.run(`PRAGMA user_version = ${version}`)
      }
    }
  }

  // v1.1 — adds ui_state for persisting UI toggle preferences (MINOR: backwards-compatible)
  private migrate_101() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS ui_state (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        show_server_pane INTEGER NOT NULL DEFAULT 1,
        show_user_pane   INTEGER NOT NULL DEFAULT 1,
        show_timestamps  INTEGER NOT NULL DEFAULT 1
      )
    `)
  }

  private nextServerSortOrder(): number {
    const row = this.db
      .query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM servers')
      .get() as { next: number } | null
    return row?.next ?? 0
  }

  private nextChannelSortOrder(serverId: string): number {
    const row = this.db
      .query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM channels WHERE server_id = ?')
      .get(serverId) as { next: number } | null
    return row?.next ?? 0
  }

  // Server methods
  saveServer(server: Server): void {
    const now = Date.now()
    const sortOrder = this.nextServerSortOrder()
    this.db.run(
      `INSERT OR REPLACE INTO servers (
        id, name, host, port, ssl, nickname, username, realname,
        password, sasl_account, sasl_password, auto_connect,
        sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        server.id,
        server.name,
        server.host,
        server.port,
        server.ssl ? 1 : 0,
        server.nickname,
        server.username || null,
        server.realname || null,
        server.password || null,
        server.saslUsername || null,
        server.saslPassword || null,
        1, // auto_connect default true
        sortOrder,
        now,
        now,
      ]
    )
  }

  getServer(id: string): PersistedServer | null {
    const row = this.db
      .query('SELECT * FROM servers WHERE id = ?')
      .get(id) as PersistedServer | null
    return row
  }

  getAllServers(): PersistedServer[] {
    return this.db
      .query('SELECT * FROM servers ORDER BY sort_order ASC, created_at ASC')
      .all() as PersistedServer[]
  }

  getAutoConnectServers(): PersistedServer[] {
    return this.db
      .query('SELECT * FROM servers WHERE auto_connect = 1 ORDER BY sort_order ASC, created_at ASC')
      .all() as PersistedServer[]
  }

  updateServer(id: string, updates: Partial<PersistedServer>): void {
    const fields: string[] = []
    const values: any[] = []

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    })

    if (fields.length === 0) return

    fields.push('updated_at = ?')
    values.push(Date.now())
    values.push(id)

    this.db.run(`UPDATE servers SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  deleteServer(id: string): void {
    this.db.run('DELETE FROM servers WHERE id = ?', [id])
  }

  // Channel methods
  saveChannel(channel: Channel, serverId: string): void {
    const now = Date.now()
    const sortOrder = this.nextChannelSortOrder(serverId)
    this.db.run(
      `INSERT OR REPLACE INTO channels (
        id, server_id, name, auto_join, sort_order, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [channel.id, serverId, channel.name, 1, sortOrder, now]
    )
  }

  getChannelsForServer(serverId: string): PersistedChannel[] {
    return this.db
      .query('SELECT * FROM channels WHERE server_id = ? ORDER BY sort_order ASC, created_at ASC')
      .all(serverId) as PersistedChannel[]
  }

  getAutoJoinChannels(serverId: string): PersistedChannel[] {
    return this.db
      .query(
        'SELECT * FROM channels WHERE server_id = ? AND auto_join = 1 ORDER BY sort_order ASC, created_at ASC'
      )
      .all(serverId) as PersistedChannel[]
  }

  updateServerSortOrder(id: string, sortOrder: number): void {
    this.db.run('UPDATE servers SET sort_order = ? WHERE id = ?', [sortOrder, id])
  }

  updateChannelSortOrder(id: string, sortOrder: number): void {
    this.db.run('UPDATE channels SET sort_order = ? WHERE id = ?', [sortOrder, id])
  }

  deleteChannel(id: string): void {
    this.db.run('DELETE FROM channels WHERE id = ?', [id])
  }

  setChannelAutoJoin(id: string, autoJoin: boolean): void {
    this.db.run('UPDATE channels SET auto_join = ? WHERE id = ?', [autoJoin ? 1 : 0, id])
  }

  // Server state methods
  saveServerState(serverId: string, state: { nickname?: string; connectionState?: string }): void {
    this.db.run(
      `INSERT OR REPLACE INTO server_state (
        server_id, current_nickname, connection_state, last_connected
      ) VALUES (?, ?, ?, ?)`,
      [serverId, state.nickname || null, state.connectionState || null, Date.now()]
    )
  }

  getServerState(serverId: string): any {
    return this.db.query('SELECT * FROM server_state WHERE server_id = ?').get(serverId)
  }

  // UI state methods
  getUIState(): PersistedUIState | null {
    const row = this.db.query('SELECT * FROM ui_state WHERE id = 1').get() as any
    if (!row) return null
    return {
      showServerPane: Boolean(row.show_server_pane),
      showUserPane: Boolean(row.show_user_pane),
      showTimestamps: Boolean(row.show_timestamps),
    }
  }

  saveUIState(state: PersistedUIState): void {
    this.db.run(
      `INSERT OR REPLACE INTO ui_state(id, show_server_pane, show_user_pane, show_timestamps)
       VALUES(1, ?, ?, ?)`,
      [state.showServerPane ? 1 : 0, state.showUserPane ? 1 : 0, state.showTimestamps ? 1 : 0]
    )
  }

  // Utility methods
  close(): void {
    this.db.close()
  }

  clearAll(): void {
    this.db.run('DELETE FROM channels')
    this.db.run('DELETE FROM server_state')
    this.db.run('DELETE FROM servers')
  }
}

// Singleton instance
let dbInstance: DatabaseService | null = null

export function getDatabase(): DatabaseService {
  if (!dbInstance) {
    dbInstance = new DatabaseService()
  }
  return dbInstance
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
