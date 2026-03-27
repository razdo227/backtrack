use std::io;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum ParserError {
    #[error("I/O error: {0}")]
    Io(#[from] io::Error),
    #[error("gzip decompression failed: {0}")]
    Decompression(String),
    #[error("XML parsing error: {0}")]
    Xml(String),
    #[error("invalid format: {0}")]
    InvalidFormat(String),
    #[error("unsupported Ableton version {major}.{minor}")]
    UnsupportedVersion { major: u8, minor: String },
    #[error("missing required element: {0}")]
    MissingRequiredElement(String),
    #[error("{item} limit exceeded: {count} > {limit}")]
    LimitExceeded {
        item: &'static str,
        count: usize,
        limit: usize,
    },
}

impl From<quick_xml::Error> for ParserError {
    fn from(err: quick_xml::Error) -> Self {
        Self::Xml(err.to_string())
    }
}
