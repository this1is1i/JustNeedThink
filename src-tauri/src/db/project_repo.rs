use crate::project::registry::ProjectInfo;
use rusqlite::Connection;

/// Insert or update a project record.
pub fn upsert_project(conn: &Connection, project: &ProjectInfo) -> Result<(), String> {
    // Pre-check the UNIQUE(path) constraint so a duplicate surfaces as a
    // friendly message instead of a raw SQL error string.
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM projects WHERE path = ?1",
            [&project.path],
            |row| row.get(0),
        )
        .ok();
    if let Some(existing_id) = existing {
        if existing_id != project.id {
            return Err(format!(
                "A project already exists at this path: {}",
                project.path
            ));
        }
    }

    conn.execute(
        "INSERT INTO projects (id, name, path, last_opened_at, created_at, is_archived, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, path=excluded.path, last_opened_at=excluded.last_opened_at,
         is_archived=excluded.is_archived",
        rusqlite::params![
            project.id, project.name, project.path, project.last_opened_at,
            project.created_at, project.is_archived as i32, 0_i32,
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

/// List all non-archived projects ordered by last_opened_at.
pub fn list_projects(conn: &Connection) -> Result<Vec<ProjectInfo>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, p.path, p.last_opened_at, p.created_at, p.is_archived,
             (SELECT COUNT(*) FROM sessions s WHERE s.project_id = p.id) as session_count
             FROM projects p
             WHERE p.is_archived = 0
             ORDER BY p.last_opened_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ProjectInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                last_opened_at: row.get(3)?,
                created_at: row.get(4)?,
                is_archived: row.get::<_, i32>(5)? != 0,
                session_count: row.get(6)?,
                git_branch: None,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut projects = Vec::new();
    for row in rows {
        let mut p = row.map_err(|e| e.to_string())?;
        // Populate git branch
        p.git_branch = crate::project::git::get_current_branch(&p.path);
        projects.push(p);
    }
    Ok(projects)
}

/// Delete a project by ID.
pub fn delete_project(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM projects WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Archive a project.
pub fn archive_project(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("UPDATE projects SET is_archived = 1 WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Touch the last_opened_at timestamp.
pub fn touch_project(conn: &Connection, id: &str) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    conn.execute("UPDATE projects SET last_opened_at = ?1 WHERE id = ?2", rusqlite::params![now, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
