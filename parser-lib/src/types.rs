use serde::{Deserialize, Serialize};

/// Result of parsing an Ableton Live set.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AbletonProject {
    pub version: AbletonVersion,
    pub tracks: Vec<Track>,
    pub master_track: Option<Track>,
    pub tempo: Option<f32>,
    pub time_signature: Option<(u8, u8)>, // (numerator, denominator)
    pub sample_references: Vec<SampleRef>,
}

/// Metadata about the Ableton version
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AbletonVersion {
    pub major: u8,
    pub minor: String,
    pub creator: Option<String>,
}

/// A reference to an external sample file used in the project.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct SampleRef {
    pub file_name: String,
    pub relative_path: Option<String>,
    pub original_file_size: Option<u64>,
}

/// A track in the Live set.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Track {
    pub id: Option<String>,
    pub track_type: TrackType,
    pub name: String,
    pub color: Option<u8>,
    pub devices: Vec<Device>,
}

/// A device (instrument or effect) attached to a track.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Device {
    pub name: String,
    pub device_type: DeviceType,
}

/// Track type as represented in Ableton's XML.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TrackType {
    Audio,
    Midi,
    Return,
    Master,
    Group,
    Unknown,
}

/// Device type for high-level categorization.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum DeviceType {
    NativeInstrument,
    NativeEffect,
    Rack,
    VstPlugin,
    Vst3Plugin,
    AudioUnitPlugin,
    Unknown,
}

/// Parsing configuration for guardrails and strictness.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ParseOptions {
    /// If true, emit an error on unknown/unsupported versions instead of best-effort parsing.
    pub strict: bool,
    /// Optional maximum tracks guard to avoid unbounded allocations.
    pub max_tracks: Option<usize>,
    /// Optional maximum devices per track guard.
    pub max_devices_per_track: Option<usize>,
    /// Optional maximum XML size after decompression (bytes).
    pub max_xml_bytes: Option<usize>,
}

impl Default for ParseOptions {
    fn default() -> Self {
        Self {
            strict: false,
            max_tracks: None,
            max_devices_per_track: None,
            max_xml_bytes: Some(100 * 1024 * 1024), // 100MB reasonable ceiling
        }
    }
}
