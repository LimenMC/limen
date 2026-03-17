use thiserror::Error;

#[derive(Debug, Error, serde::Serialize)]
#[serde(tag = "type", content = "message")]
pub enum AppError {
    #[error("API error: {0}")]
    ApiError(String),
    
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("File error: {0}")]
    FileError(String),
    
    #[error("Database error: {0}")]
    DatabaseError(String),
    
    #[error("Invalid parameter: {0}")]
    InvalidParam(String),
    
    #[error("Authentication error: {0}")]
    AuthError(String),
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::NetworkError(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::FileError(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::ApiError(e.to_string())
    }
}

impl From<zip::result::ZipError> for AppError {
    fn from(e: zip::result::ZipError) -> Self {
        AppError::FileError(format!("ZIP error: {}", e))
    }
}
