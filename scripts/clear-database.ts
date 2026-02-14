#!/usr/bin/env bun
import { getDatabase, closeDatabase } from '../src/services/database'
import { getDatabasePath } from '../src/utils/paths'
import fs from 'fs'

console.log('🗑️  Clearing ObbyTTY database...')

try {
  const dbPath = getDatabasePath()

  if (fs.existsSync(dbPath)) {
    // Clear all data
    const db = getDatabase()
    db.clearAll()
    closeDatabase()

    console.log('✅ Database cleared successfully!')
    console.log(`📍 Location: ${dbPath}`)
  } else {
    console.log('ℹ️  No database found - nothing to clear')
  }
} catch (error) {
  console.error('❌ Failed to clear database:', error)
  process.exit(1)
}
