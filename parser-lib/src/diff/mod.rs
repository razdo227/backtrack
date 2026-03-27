//! Diff engine for comparing Ableton projects
//!
//! This module provides functionality to compare two `AbletonProject` structs
//! and produce a human-readable diff showing what changed between versions.
//!
//! # Example
//!
//! ```rust,no_run
//! use backtrack_parser::{parse_file, diff_projects};
//!
//! let old_project = parse_file("v1.als").unwrap();
//! let new_project = parse_file("v2.als").unwrap();
//!
//! let diff = diff_projects(&old_project, &new_project);
//!
//! if !diff.is_empty() {
//!     println!("{}", diff.to_summary());
//! }
//! ```

mod device_diff;
mod formatter;
mod track_diff;
mod types;

pub use types::{MasterChange, ProjectDiff, TrackModification};

use crate::types::AbletonProject;
use device_diff::diff_devices;
use track_diff::diff_tracks;

/// Compare two Ableton projects and return a structured diff
///
/// This function compares all aspects of the projects:
/// - Track additions/removals
/// - Track modifications (name, color, devices)
/// - Master track changes
///
/// # Example
///
/// ```rust,no_run
/// # use backtrack_parser::{AbletonProject, diff_projects};
/// # fn example(old: &AbletonProject, new: &AbletonProject) {
/// let diff = diff_projects(old, new);
///
/// println!("Changes: {}", diff.change_count());
/// println!("Summary:\n{}", diff.to_summary());
/// # }
/// ```
pub fn diff_projects(old: &AbletonProject, new: &AbletonProject) -> ProjectDiff {
    // Diff regular tracks
    let (tracks_added, tracks_removed, tracks_modified) = diff_tracks(&old.tracks, &new.tracks);

    // Diff master track
    let master_changes = diff_master_track(old, new);

    // Diff tempo
    let tempo_changed = if old.tempo != new.tempo {
        Some((old.tempo, new.tempo))
    } else {
        None
    };

    // Diff time signature
    let time_signature_changed = if old.time_signature != new.time_signature {
        Some((old.time_signature, new.time_signature))
    } else {
        None
    };

    // Diff sample refs
    // Use HashSet for O(n) diffing? SampleRef implements Hash/Eq.
    // Since Vec is small, iter logic is fine, but for many samples, set is better.
    // Let's optimize with HashSet.
    use std::collections::HashSet;
    let old_refs: HashSet<_> = old.sample_references.iter().collect();
    let new_refs: HashSet<_> = new.sample_references.iter().collect();

    let sample_refs_added = new_refs
        .difference(&old_refs)
        .map(|r| (*r).clone())
        .collect();

    let sample_refs_removed = old_refs
        .difference(&new_refs)
        .map(|r| (*r).clone())
        .collect();

    ProjectDiff {
        tracks_added,
        tracks_removed,
        tracks_modified,
        master_changes,
        tempo_changed,
        time_signature_changed,
        sample_refs_added,
        sample_refs_removed,
    }
}

/// Diff the master tracks and return master-specific changes
fn diff_master_track(old: &AbletonProject, new: &AbletonProject) -> Vec<MasterChange> {
    // Get references to master tracks (use empty vec if None)
    let old_devices = old
        .master_track
        .as_ref()
        .map(|t| t.devices.as_slice())
        .unwrap_or(&[]);

    let new_devices = new
        .master_track
        .as_ref()
        .map(|t| t.devices.as_slice())
        .unwrap_or(&[]);

    let (devices_added, devices_removed) = diff_devices(old_devices, new_devices);

    let mut changes = Vec::new();

    for device in devices_added {
        changes.push(MasterChange::DeviceAdded(device));
    }

    for device in devices_removed {
        changes.push(MasterChange::DeviceRemoved(device));
    }

    changes
}

impl ProjectDiff {
    /// Generate a human-readable summary of the diff
    ///
    /// Returns a formatted string with emoji indicators and categorized changes.
    ///
    /// # Example Output
    ///
    /// ```text
    /// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    /// ✅ ADDED (2)
    ///   • "Drums" (MIDI)
    ///   • "FX Return" (Return)
    ///
    /// ❌ REMOVED (1)
    ///   • "Old Lead" (Audio)
    ///
    /// 📝 MODIFIED (1)
    ///   • "Bass" → "Bass Line"
    ///     - Added: Compressor
    ///     - Removed: EQ Eight
    /// ```
    pub fn to_summary(&self) -> String {
        formatter::format_diff(self)
    }

    /// Generate a short, single-line summary (useful for timelines/logs).
    pub fn to_summary_line(&self) -> String {
        formatter::format_summary_line(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{AbletonVersion, Device, DeviceType, Track, TrackType};

    fn create_project(tracks: Vec<Track>, master_devices: Vec<Device>) -> AbletonProject {
        AbletonProject {
            version: AbletonVersion {
                major: 11,
                minor: "0".to_string(),
                creator: None,
            },
            tracks,
            master_track: Some(Track {
                id: Some("master".to_string()),
                track_type: TrackType::Master,
                name: "Master".to_string(),
                color: None,
                devices: master_devices,
            }),
            tempo: Some(120.0),
            time_signature: Some((4, 4)),
            sample_references: vec![],
        }
    }

    fn track(id: &str, name: &str) -> Track {
        Track {
            id: Some(id.to_string()),
            track_type: TrackType::Midi,
            name: name.to_string(),
            color: None,
            devices: vec![],
        }
    }

    fn device(name: &str) -> Device {
        Device {
            name: name.to_string(),
            device_type: DeviceType::NativeEffect,
        }
    }

    #[test]
    fn test_identical_projects() {
        let project = create_project(vec![track("1", "Bass")], vec![]);
        let diff = diff_projects(&project, &project);

        assert!(diff.is_empty());
        assert_eq!(diff.change_count(), 0);
    }

    #[test]
    fn test_track_added() {
        let old = create_project(vec![track("1", "Bass")], vec![]);
        let new = create_project(vec![track("1", "Bass"), track("2", "Drums")], vec![]);

        let diff = diff_projects(&old, &new);

        assert_eq!(diff.tracks_added.len(), 1);
        assert_eq!(diff.tracks_added[0].name, "Drums");
        assert!(!diff.is_empty());
    }

    #[test]
    fn test_track_removed() {
        let old = create_project(vec![track("1", "Bass"), track("2", "Drums")], vec![]);
        let new = create_project(vec![track("1", "Bass")], vec![]);

        let diff = diff_projects(&old, &new);

        assert_eq!(diff.tracks_removed.len(), 1);
        assert_eq!(diff.tracks_removed[0].name, "Drums");
    }

    #[test]
    fn test_master_device_added() {
        let old = create_project(vec![], vec![]);
        let new = create_project(vec![], vec![device("Limiter")]);

        let diff = diff_projects(&old, &new);

        assert_eq!(diff.master_changes.len(), 1);
        match &diff.master_changes[0] {
            MasterChange::DeviceAdded(d) => assert_eq!(d.name, "Limiter"),
            _ => panic!("Expected DeviceAdded"),
        }
    }

    #[test]
    fn test_empty_to_first_tracks() {
        let old = create_project(vec![], vec![]);
        let new = create_project(
            vec![track("1", "Bass"), track("2", "Drums"), track("3", "Lead")],
            vec![device("Limiter")],
        );

        let diff = diff_projects(&old, &new);

        assert_eq!(diff.tracks_added.len(), 3);
        assert_eq!(diff.master_changes.len(), 1);
        assert_eq!(diff.change_count(), 4);
    }

    #[test]
    fn test_complex_changes() {
        let mut old_track = track("1", "Bass");
        old_track.devices = vec![device("EQ"), device("Compressor")];

        let mut new_track = track("1", "Bass Line");
        new_track.devices = vec![device("EQ"), device("Reverb")];
        new_track.color = Some(5);

        let old = create_project(vec![old_track, track("2", "Old Track")], vec![]);
        let new = create_project(
            vec![new_track, track("3", "New Track")],
            vec![device("Limiter")],
        );

        let diff = diff_projects(&old, &new);

        // 1 added, 1 removed, 1 modified, 1 master change
        assert_eq!(diff.tracks_added.len(), 1);
        assert_eq!(diff.tracks_removed.len(), 1);
        assert_eq!(diff.tracks_modified.len(), 1);
        assert_eq!(diff.master_changes.len(), 1);

        let mod_track = &diff.tracks_modified[0];
        assert!(mod_track.name_changed);
        assert!(mod_track.color_changed.is_some());
        assert_eq!(mod_track.devices_added.len(), 1);
        assert_eq!(mod_track.devices_removed.len(), 1);
    }
}
