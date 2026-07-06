use thiserror::Error;

/// Unified error type for the JustNeedThink backend.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("CLI not found: {0}")]
    CliNotFound(String),

    #[error("Process error: {0}")]
    Process(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("{0}")]
    Other(String),
}

/// Result alias for Tauri commands.
pub type AppResult<T> = Result<T, String>;

impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}
