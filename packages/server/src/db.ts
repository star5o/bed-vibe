import { Database } from 'bun:sqlite'
import { config } from './config'
import { mkdirSync, existsSync, readFileSync, unlinkSync } from 'node:fs'

let db: Database

export function getDb(): Database {
  if (!db) {
    if (!existsSync(config.dataDir)) {
      mkdirSync(config.dataDir, { recursive: true })
    }
    db = new Database(config.dbPath, { create: true })
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA busy_timeout = 5000')
    migrate(db)
  }
  return db
}

function getVersion(db: Database): number {
  try {
    const row = db.query<{ version: number }, []>(
      `SELECT MAX(version) as version FROM _migrations`
    ).get()
    return row?.version ?? 0
  } catch {
    return 0
  }
}

function setVersion(db: Database, version: number) {
  db.run(
    `INSERT INTO _migrations (version, applied_at) VALUES (?, ?)`,
    [version, Date.now()]
  )
}

function migrate(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `)

  const version = getVersion(db)

  if (version < 1) {
    migrateV1(db)
    setVersion(db, 1)
  }

  if (version < 2) {
    migrateV2(db)
    setVersion(db, 2)
  }

  if (version < 3) {
    migrateV3(db)
    setVersion(db, 3)
  }
}

// V1: Original schema
function migrateV1(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      agent TEXT NOT NULL,
      cwd TEXT NOT NULL DEFAULT '',
      model TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      thinking INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      source TEXT NOT NULL,
      content TEXT NOT NULL,
      local_id TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(session_id, seq),
      UNIQUE(session_id, local_id)
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      tool TEXT NOT NULL,
      input TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      decision TEXT,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER,
      acked INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session_seq
      ON messages(session_id, seq);
    CREATE INDEX IF NOT EXISTS idx_permissions_session
      ON permissions(session_id, status);
  `)
}

// V2: Multi-user + multi-machine
function migrateV2(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS machines (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      hostname TEXT,
      last_seen_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_machines_user ON machines(user_id);
    CREATE INDEX IF NOT EXISTS idx_machines_token ON machines(token);
  `)

  // Add columns to sessions
  const cols = db.query<{ name: string }, []>(
    `PRAGMA table_info(sessions)`
  ).all()
  const colNames = cols.map(c => c.name)

  if (!colNames.includes('machine_id')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN machine_id TEXT`)
  }
  if (!colNames.includes('name')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN name TEXT`)
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_machine ON sessions(machine_id);
  `)

  // Settings table for server-wide config
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT OR IGNORE INTO settings (key, value) VALUES ('registration_enabled', 'false');
  `)

  // Migrate legacy token file → default user + machine
  migrateLegacyToken(db)
}

function migrateLegacyToken(db: Database) {
  const tokenPath = `${config.dataDir}/.token`
  if (!existsSync(tokenPath)) return

  const existingUsers = db.query<{ id: string }, []>(
    `SELECT id FROM users LIMIT 1`
  ).get()
  if (existingUsers) return

  const legacyToken = readFileSync(tokenPath, 'utf-8').trim()
  const now = Date.now()
  const userId = crypto.randomUUID()
  const machineId = crypto.randomUUID()

  // Create default admin user (password: the legacy token, user should change it)
  const passwordHash = legacyToken // Will be hashed properly on first login
  db.run(
    `INSERT INTO users (id, username, password_hash, display_name, is_admin, created_at)
     VALUES (?, 'admin', ?, 'Admin', 1, ?)`,
    [userId, passwordHash, now]
  )

  // Create default machine with the legacy token
  db.run(
    `INSERT INTO machines (id, user_id, name, token, created_at)
     VALUES (?, ?, 'Default Machine', ?, ?)`,
    [machineId, userId, legacyToken, now]
  )

  // Associate all existing sessions with this machine
  db.run(`UPDATE sessions SET machine_id = ?`, [machineId])

  // Remove legacy token file
  try { unlinkSync(tokenPath) } catch {}
}

// V3: Daemon support + new features
function migrateV3(db: Database) {
  // New columns on sessions
  const cols = db.query<{ name: string }, []>(
    `PRAGMA table_info(sessions)`
  ).all()
  const colNames = cols.map(c => c.name)

  if (!colNames.includes('effort')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN effort TEXT`)
  }
  if (!colNames.includes('permission_mode')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN permission_mode TEXT`)
  }
  if (!colNames.includes('source')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN source TEXT DEFAULT 'local'`)
  }
  if (!colNames.includes('total_input_tokens')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN total_input_tokens INTEGER DEFAULT 0`)
  }
  if (!colNames.includes('total_output_tokens')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN total_output_tokens INTEGER DEFAULT 0`)
  }
  if (!colNames.includes('total_cost')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN total_cost REAL DEFAULT 0`)
  }
  if (!colNames.includes('archived_at')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN archived_at INTEGER`)
  }

  // Push subscriptions
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
  `)

  // Usage tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read INTEGER NOT NULL DEFAULT 0,
      cache_write INTEGER NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_usage_session ON usage(session_id);
  `)

  // File uploads
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_files_session ON files(session_id);
  `)
}
