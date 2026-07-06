//! SQLite schema definitions and migration system (stub).

/// Schema version — bump when making schema changes.
pub const CURRENT_VERSION: u32 = 1;

/// Check and apply migrations.
pub fn run_migrations(_conn: &rusqlite::Connection) -> Result<(), String> {
    // Phase 2 will implement the full migration system.
    Ok(())
}
