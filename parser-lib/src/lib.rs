//! Backtrack shared Ableton `.als` parser library.
//!
//! Provides a zero-alloc-friendly, streaming XML parser built on `quick-xml`.
//!
//! # Features
//!
//! - **Parsing**: Parse `.als` files to extract project structure
//! - **Diffing**: Compare two versions of a project to see what changed
//!
//! # Examples
//!
//! ## Parsing a project
//!
//! ```no_run
//! use backtrack_parser::parse_file;
//!
//! let project = parse_file("MyProject.als").unwrap();
//! println!("Tracks: {}", project.tracks.len());
//! ```
//!
//! ## Diffing two versions
//!
//! ```no_run
//! use backtrack_parser::{parse_file, diff_projects};
//!
//! let old = parse_file("v1.als").unwrap();
//! let new = parse_file("v2.als").unwrap();
//!
//! let diff = diff_projects(&old, &new);
//! println!("{}", diff.to_summary());
//! ```

mod decompressor;
pub mod diff;
mod error;
mod types;
mod xml_parser;

pub use diff::{diff_projects, MasterChange, ProjectDiff, TrackModification};
pub use error::ParserError;
pub use types::{
    AbletonProject, AbletonVersion, Device, DeviceType, ParseOptions, Track, TrackType,
};

use std::fs;
use std::path::Path;

use decompressor::decompress_als;
use xml_parser::parse_xml;

/// Parse an Ableton Live Set (`.als`) from a filesystem path.
#[must_use = "call `parse_file` and handle the result"]
pub fn parse_file(path: impl AsRef<Path>) -> Result<AbletonProject, ParserError> {
    parse_file_with_options(path, ParseOptions::default())
}

/// Parse an Ableton Live Set from a filesystem path with custom options.
#[must_use = "call `parse_file_with_options` and handle the result"]
pub fn parse_file_with_options(
    path: impl AsRef<Path>,
    options: ParseOptions,
) -> Result<AbletonProject, ParserError> {
    let data = fs::read(path)?;
    parse_bytes_with_options(&data, options)
}

/// Parse an Ableton Live Set from gzipped bytes.
#[must_use = "call `parse_bytes` and handle the result"]
pub fn parse_bytes(data: &[u8]) -> Result<AbletonProject, ParserError> {
    parse_bytes_with_options(data, ParseOptions::default())
}

/// Parse an Ableton Live Set from gzipped bytes with custom options.
#[must_use = "call `parse_bytes_with_options` and handle the result"]
pub fn parse_bytes_with_options(
    data: &[u8],
    options: ParseOptions,
) -> Result<AbletonProject, ParserError> {
    let xml = decompress_als(data, options.max_xml_bytes)?;
    parse_xml(&xml, &options)
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::io::Write;

    fn sample_xml() -> String {
        r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" MinorVersion="11.3.4" Creator="Ableton Live 11.3.4">
  <LiveSet>
    <Tracks>
      <AudioTrack Id="0">
        <Name><EffectiveName Value="Bass" /></Name>
        <Color Value="16" />
        <DeviceChain>
          <Devices>
            <AudioEffectGroupDevice>
              <UserName Value="EQ Eight" />
            </AudioEffectGroupDevice>
            <PluginDevice>
              <PluginDesc>
                <VstPluginInfo>
                  <PlugName Value="Serum" />
                </VstPluginInfo>
              </PluginDesc>
            </PluginDevice>
          </Devices>
        </DeviceChain>
      </AudioTrack>
      <MidiTrack Id="1">
        <Name><EffectiveName Value="Drums" /></Name>
      </MidiTrack>
    </Tracks>
    <MasterTrack>
      <Name><EffectiveName Value="Master" /></Name>
    </MasterTrack>
  </LiveSet>
</Ableton>
"#
        .to_string()
    }

    fn gzip(bytes: &[u8]) -> Vec<u8> {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(bytes).unwrap();
        encoder.finish().unwrap()
    }

    #[test]
    fn decompress_valid_gzip() {
        let data = gzip(b"hello");
        let out = decompress_als(&data, None).unwrap();
        assert_eq!(out, "hello");
    }

    #[test]
    fn decompress_invalid_gzip() {
        let err = decompress_als(b"not-gzip", None).unwrap_err();
        assert!(matches!(err, ParserError::Decompression(_)));
    }

    #[test]
    fn parse_simple_project() {
        let data = gzip(sample_xml().as_bytes());
        let project = parse_bytes(&data).expect("parsed");
        assert_eq!(project.version.major, 5);
        assert_eq!(project.tracks.len(), 2);
        assert_eq!(project.tracks[0].name, "Bass");
        assert_eq!(project.tracks[0].devices.len(), 2);
    }

    #[test]
    fn parse_enforces_track_limit() {
        let mut options = ParseOptions::default();
        options.max_tracks = Some(1);
        let data = gzip(sample_xml().as_bytes());
        let err = parse_bytes_with_options(&data, options).unwrap_err();
        assert!(matches!(err, ParserError::LimitExceeded { .. }));
    }

    #[test]
    fn unsupported_version_is_allowed_when_not_strict() {
        let xml = r#"<Ableton MajorVersion="9" MinorVersion="99.0"><LiveSet></LiveSet></Ableton>"#;
        let data = gzip(xml.as_bytes());
        let project = parse_bytes(&data).unwrap();
        assert_eq!(project.version.major, 9);
    }

    #[test]
    fn unsupported_version_errors_in_strict_mode() {
        let xml = r#"<Ableton MajorVersion="9" MinorVersion="99.0"><LiveSet></LiveSet></Ableton>"#;
        let data = gzip(xml.as_bytes());
        let mut options = ParseOptions::default();
        options.strict = true;
        let err = parse_bytes_with_options(&data, options).unwrap_err();
        assert!(matches!(err, ParserError::UnsupportedVersion { .. }));
    }
}
