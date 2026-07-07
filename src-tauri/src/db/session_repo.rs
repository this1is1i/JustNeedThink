use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRecord {
    pub id: String,
    pub project_id: Option<String>,
    pub display_name: Option<String>,
    pub preview: Option<String>,
    pub mode: String,
    pub model: Option<String>,
    pub status: String,
    pub message_count: i64,
    pub total_input_tokens: i64,
    pub total_output_tokens: i64,
    pub stdin_id: Option<String>,
    pub session_path: String,
    pub created_at: i64,
    pub modified_at: i64,
    pub is_pinned: bool,
    pub is_archived: bool,
}

/// Insert or update a session record.
pub fn upsert_session(conn: &Connection, session: &SessionRecord) -> Result<(), String> {
    conn.execute(
        "INSERT INTO sessions (id, project_id, display_name, preview, mode, model, status,
         message_count, total_input_tokens, total_output_tokens, stdin_id, session_path,
         created_at, modified_at, is_pinned, is_archived)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
         ON CONFLICT(id) DO UPDATE SET
         display_name=excluded.display_name, preview=excluded.preview,
         status=excluded.status, message_count=excluded.message_count,
         total_input_tokens=excluded.total_input_tokens,
         total_output_tokens=excluded.total_output_tokens,
         stdin_id=excluded.stdin_id, modified_at=excluded.modified_at,
         is_pinned=excluded.is_pinned, is_archived=excluded.is_archived",
        rusqlite::params![
            session.id, session.project_id, session.display_name, session.preview,
            session.mode, session.model, session.status, session.message_count,
            session.total_input_tokens, session.total_output_tokens, session.stdin_id,
            session.session_path, session.created_at, session.modified_at,
            session.is_pinned as i32, session.is_archived as i32,
        ],
    ).map_err(|e| format!("Failed to upsert session: {}", e))?;
    Ok(())
}

/// List all sessions ordered by modified_at descending.
pub fn list_sessions(conn: &Connection) -> Result<Vec<SessionRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, display_name, preview, mode, model, status,
             message_count, total_input_tokens, total_output_tokens, stdin_id, session_path,
             created_at, modified_at, is_pinned, is_archived
             FROM sessions WHERE is_archived = 0
             ORDER BY is_pinned DESC, modified_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(SessionRecord {
                id: row.get(0)?,
                project_id: row.get(1)?,
                display_name: row.get(2)?,
                preview: row.get(3)?,
                mode: row.get(4)?,
                model: row.get(5)?,
                status: row.get(6)?,
                message_count: row.get(7)?,
                total_input_tokens: row.get(8)?,
                total_output_tokens: row.get(9)?,
                stdin_id: row.get(10)?,
                session_path: row.get(11)?,
                created_at: row.get(12)?,
                modified_at: row.get(13)?,
                is_pinned: row.get::<_, i32>(14)? != 0,
                is_archived: row.get::<_, i32>(15)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut sessions = Vec::new();
    for row in rows {
        sessions.push(row.map_err(|e| e.to_string())?);
    }
    Ok(sessions)
}

/// Get a single session by ID.
pub fn get_session(conn: &Connection, id: &str) -> Result<Option<SessionRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, display_name, preview, mode, model, status,
             message_count, total_input_tokens, total_output_tokens, stdin_id, session_path,
             created_at, modified_at, is_pinned, is_archived
             FROM sessions WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let result = stmt.query_row([id], |row| {
        Ok(SessionRecord {
            id: row.get(0)?,
            project_id: row.get(1)?,
            display_name: row.get(2)?,
            preview: row.get(3)?,
            mode: row.get(4)?,
            model: row.get(5)?,
            status: row.get(6)?,
            message_count: row.get(7)?,
            total_input_tokens: row.get(8)?,
            total_output_tokens: row.get(9)?,
            stdin_id: row.get(10)?,
            session_path: row.get(11)?,
            created_at: row.get(12)?,
            modified_at: row.get(13)?,
            is_pinned: row.get::<_, i32>(14)? != 0,
            is_archived: row.get::<_, i32>(15)? != 0,
        })
    });

    match result {
        Ok(session) => Ok(Some(session)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Delete a session.
pub fn delete_session(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM sessions WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Set a setting key-value pair.
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    conn.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
        rusqlite::params![key, value, now],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

/// Get a setting value by key.
pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        [key],
        |row| row.get(0),
    );
    match result {
        Ok(val) => Ok(Some(val)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}
