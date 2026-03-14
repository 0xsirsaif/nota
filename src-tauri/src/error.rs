use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize)]
pub enum NotaError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("File system error: {0}")]
    FileSystem(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Notification error: {0}")]
    Notification(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, NotaError>;

impl From<sqlx::Error> for NotaError {
    fn from(e: sqlx::Error) -> Self {
        NotaError::Database(e.to_string())
    }
}

impl From<std::io::Error> for NotaError {
    fn from(e: std::io::Error) -> Self {
        NotaError::FileSystem(e.to_string())
    }
}

impl From<NotaError> for String {
    fn from(e: NotaError) -> Self {
        e.to_string()
    }
}
