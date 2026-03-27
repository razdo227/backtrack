use flate2::read::GzDecoder;
use std::io::Read;

use crate::error::ParserError;

/// Decompress gzipped ALS data into a UTF-8 string.
pub(crate) fn decompress_als(
    data: &[u8],
    max_xml_bytes: Option<usize>,
) -> Result<String, ParserError> {
    let mut decoder = GzDecoder::new(data);
    let mut buffer = Vec::new();
    decoder
        .read_to_end(&mut buffer)
        .map_err(|e| ParserError::Decompression(format!("gzip decode failed: {e}")))?;

    if let Some(limit) = max_xml_bytes {
        if buffer.len() > limit {
            return Err(ParserError::LimitExceeded {
                item: "xml_bytes",
                count: buffer.len(),
                limit,
            });
        }
    }

    String::from_utf8(buffer)
        .map_err(|e| ParserError::Decompression(format!("invalid UTF-8 after decompression: {e}")))
}
