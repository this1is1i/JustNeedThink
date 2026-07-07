use rusqlite::Connection;

pub const CURRENT_VERSION: u32 = 1;

/// Run all pending migrations on the database.
pub fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("PRAGMA journal_mode=WAL;").map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys=ON;").map_err(|e| e.to_string())?;

    // Create schema version table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER NOT NULL,
            applied_at INTEGER NOT NULL
        );"
    ).map_err(|e| e.to_string())?;

    let current: u32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if current < 1 {
        migrate_v1(conn)?;
    }

    Ok(())
}

fn migrate_v1(conn: &Connection) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    conn.execute_batch(
        "
        -- Projects
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            last_opened_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            is_archived INTEGER NOT NULL DEFAULT 0,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        -- Sessions
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
            display_name TEXT,
            preview TEXT,
            mode TEXT NOT NULL DEFAULT 'code',
            model TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            message_count INTEGER DEFAULT 0,
            total_input_tokens INTEGER DEFAULT 0,
            total_output_tokens INTEGER DEFAULT 0,
            stdin_id TEXT,
            session_path TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            modified_at INTEGER NOT NULL,
            is_pinned INTEGER DEFAULT 0,
            is_archived INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_modified ON sessions(modified_at DESC);
        CREATE INDEX IF NOT EXISTS idx_sessions_pinned ON sessions(is_pinned);

        -- Messages
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            type TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            tool_name TEXT,
            tool_input TEXT,
            tool_result TEXT,
            is_partial INTEGER DEFAULT 0,
            timestamp INTEGER NOT NULL,
            seq INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, seq);

        -- Settings (key-value)
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );
        "
    ).map_err(|e| format!("Migration v1 failed: {}", e))?;

    conn.execute(
        "INSERT INTO schema_version (version, applied_at) VALUES (1, ?1)",
        [now],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

/// Get the database path in the app data directory.
pub fn get_db_path() -> Result<std::path::PathBuf, String> {
    let dir = dirs::data_local_dir()
        .ok_or_else(|| "Cannot find app data directory".to_string())?
        .join("JustNeedThink");

    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    Ok(dir.join("justneedthink.db"))
}

/// Open or create the SQLite database, running migrations.
pub fn open_database() -> Result<Connection, String> {
    let path = get_db_path()?;
    let conn = Connection::open(&path).map_err(|e| format!("Failed to open database: {}", e))?;
    run_migrations(&conn)?;
    Ok(conn)
}
