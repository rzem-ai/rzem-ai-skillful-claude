use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("invalid path: {0}")]
    InvalidPath(String),

    #[error("not a CLAUDE.md or SKILL file: {0}")]
    UnsupportedFile(String),

    #[error("walkdir error: {0}")]
    Walk(#[from] walkdir::Error),

    #[error("serde error: {0}")]
    Serde(#[from] serde_json::Error),
}

// Tauri requires command errors to implement Serialize so they can cross
// the IPC boundary. We just emit the human-readable string.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
