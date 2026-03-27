use super::device_diff::diff_devices;
use super::types::TrackModification;
use crate::types::Track;
use std::collections::HashMap;

/// Diff two track lists and return (added, removed, modified)
///
/// Matching strategy:
/// 1. Primary: Match by track ID (if IDs are stable)
/// 2. Fallback: Match by name + type (for edge cases)
///
/// Returns: (tracks_added, tracks_removed, tracks_modified)
pub fn diff_tracks(
    old_tracks: &[Track],
    new_tracks: &[Track],
) -> (Vec<Track>, Vec<Track>, Vec<TrackModification>) {
    // Build ID-based maps for O(1) lookups
    let old_map: HashMap<String, &Track> =
        old_tracks.iter().map(|t| (get_track_key(t), t)).collect();

    let new_map: HashMap<String, &Track> =
        new_tracks.iter().map(|t| (get_track_key(t), t)).collect();

    // Find added tracks (keys in new but not in old)
    let added: Vec<Track> = new_map
        .keys()
        .filter(|key| !old_map.contains_key(*key))
        .filter_map(|key| new_map.get(key))
        .map(|&track| track.clone())
        .collect();

    // Find removed tracks (keys in old but not in new)
    let removed: Vec<Track> = old_map
        .keys()
        .filter(|key| !new_map.contains_key(*key))
        .filter_map(|key| old_map.get(key))
        .map(|&track| track.clone())
        .collect();

    // Find modified tracks (keys in both, but with differences)
    let modified: Vec<TrackModification> = old_map
        .keys()
        .filter(|key| new_map.contains_key(*key))
        .filter_map(|key| {
            let old_track = old_map.get(key)?;
            let new_track = new_map.get(key)?;
            diff_single_track(old_track, new_track)
        })
        .collect();

    (added, removed, modified)
}

/// Compare two tracks and return a TrackModification if they differ
///
/// Returns None if tracks are identical
fn diff_single_track(old_track: &Track, new_track: &Track) -> Option<TrackModification> {
    let name_changed = old_track.name != new_track.name;
    let color_changed = if old_track.color != new_track.color {
        Some((old_track.color, new_track.color))
    } else {
        None
    };

    // Diff devices
    let (devices_added, devices_removed) = diff_devices(&old_track.devices, &new_track.devices);

    // Only return a modification if something actually changed
    if !name_changed
        && color_changed.is_none()
        && devices_added.is_empty()
        && devices_removed.is_empty()
    {
        return None;
    }

    Some(TrackModification {
        track_id: new_track
            .id
            .clone()
            .unwrap_or_else(|| get_track_key(new_track)),
        old_name: old_track.name.clone(),
        new_name: new_track.name.clone(),
        name_changed,
        color_changed,
        devices_added,
        devices_removed,
    })
}

/// Get a unique key for track matching
///
/// Priority:
/// 1. Use ID if present and non-empty
/// 2. Fallback to name+type composite (for edge cases where ID changes)
fn get_track_key(track: &Track) -> String {
    if let Some(ref id) = track.id {
        if !id.is_empty() {
            return id.clone();
        }
    }

    // Fallback: generate key from name + type
    format!("{}_{:?}", track.name, track.track_type)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Device, DeviceType, TrackType};

    fn track(id: &str, name: &str, track_type: TrackType, devices: Vec<Device>) -> Track {
        Track {
            id: Some(id.to_string()),
            track_type,
            name: name.to_string(),
            color: None,
            devices,
        }
    }

    fn device(name: &str) -> Device {
        Device {
            name: name.to_string(),
            device_type: DeviceType::NativeEffect,
        }
    }

    #[test]
    fn test_no_changes() {
        let tracks = vec![track("1", "Bass", TrackType::Midi, vec![])];
        let (added, removed, modified) = diff_tracks(&tracks, &tracks);

        assert!(added.is_empty());
        assert!(removed.is_empty());
        assert!(modified.is_empty());
    }

    #[test]
    fn test_track_added() {
        let old = vec![track("1", "Bass", TrackType::Midi, vec![])];
        let new = vec![
            track("1", "Bass", TrackType::Midi, vec![]),
            track("2", "Drums", TrackType::Midi, vec![]),
        ];

        let (added, removed, modified) = diff_tracks(&old, &new);

        assert_eq!(added.len(), 1);
        assert_eq!(added[0].name, "Drums");
        assert!(removed.is_empty());
        assert!(modified.is_empty());
    }

    #[test]
    fn test_track_removed() {
        let old = vec![
            track("1", "Bass", TrackType::Midi, vec![]),
            track("2", "Drums", TrackType::Midi, vec![]),
        ];
        let new = vec![track("1", "Bass", TrackType::Midi, vec![])];

        let (added, removed, modified) = diff_tracks(&old, &new);

        assert!(added.is_empty());
        assert_eq!(removed.len(), 1);
        assert_eq!(removed[0].name, "Drums");
        assert!(modified.is_empty());
    }

    #[test]
    fn test_track_renamed() {
        let old = vec![track("1", "Bass", TrackType::Midi, vec![])];
        let new = vec![track("1", "Bass Line", TrackType::Midi, vec![])];

        let (added, removed, modified) = diff_tracks(&old, &new);

        assert!(added.is_empty());
        assert!(removed.is_empty());
        assert_eq!(modified.len(), 1);
        assert!(modified[0].name_changed);
        assert_eq!(modified[0].old_name, "Bass");
        assert_eq!(modified[0].new_name, "Bass Line");
    }

    #[test]
    fn test_track_color_changed() {
        let mut old = vec![track("1", "Bass", TrackType::Midi, vec![])];
        old[0].color = Some(10);

        let mut new = vec![track("1", "Bass", TrackType::Midi, vec![])];
        new[0].color = Some(20);

        let (added, removed, modified) = diff_tracks(&old, &new);

        assert!(added.is_empty());
        assert!(removed.is_empty());
        assert_eq!(modified.len(), 1);
        assert!(!modified[0].name_changed);
        assert_eq!(modified[0].color_changed, Some((Some(10), Some(20))));
    }

    #[test]
    fn test_device_added_to_track() {
        let old = vec![track("1", "Bass", TrackType::Midi, vec![])];
        let new = vec![track(
            "1",
            "Bass",
            TrackType::Midi,
            vec![device("Compressor")],
        )];

        let (added, removed, modified) = diff_tracks(&old, &new);

        assert!(added.is_empty());
        assert!(removed.is_empty());
        assert_eq!(modified.len(), 1);
        assert_eq!(modified[0].devices_added.len(), 1);
        assert_eq!(modified[0].devices_added[0].name, "Compressor");
        assert!(modified[0].devices_removed.is_empty());
    }

    #[test]
    fn test_device_removed_from_track() {
        let old = vec![track(
            "1",
            "Bass",
            TrackType::Midi,
            vec![device("Compressor")],
        )];
        let new = vec![track("1", "Bass", TrackType::Midi, vec![])];

        let (added, removed, modified) = diff_tracks(&old, &new);

        assert!(added.is_empty());
        assert!(removed.is_empty());
        assert_eq!(modified.len(), 1);
        assert!(modified[0].devices_added.is_empty());
        assert_eq!(modified[0].devices_removed.len(), 1);
        assert_eq!(modified[0].devices_removed[0].name, "Compressor");
    }

    #[test]
    fn test_complex_modifications() {
        let old = vec![track(
            "1",
            "Bass",
            TrackType::Midi,
            vec![device("EQ"), device("Compressor")],
        )];

        let mut new = vec![track(
            "1",
            "Bass Line",
            TrackType::Midi,
            vec![device("EQ"), device("Reverb")],
        )];
        new[0].color = Some(5);

        let (added, removed, modified) = diff_tracks(&old, &new);

        assert!(added.is_empty());
        assert!(removed.is_empty());
        assert_eq!(modified.len(), 1);

        let mod_track = &modified[0];
        assert!(mod_track.name_changed);
        assert_eq!(mod_track.old_name, "Bass");
        assert_eq!(mod_track.new_name, "Bass Line");
        assert_eq!(mod_track.color_changed, Some((None, Some(5))));
        assert_eq!(mod_track.devices_added.len(), 1);
        assert_eq!(mod_track.devices_added[0].name, "Reverb");
        assert_eq!(mod_track.devices_removed.len(), 1);
        assert_eq!(mod_track.devices_removed[0].name, "Compressor");
    }

    #[test]
    fn test_empty_to_tracks() {
        let old = vec![];
        let new = vec![
            track("1", "Bass", TrackType::Midi, vec![]),
            track("2", "Drums", TrackType::Midi, vec![]),
        ];

        let (added, removed, modified) = diff_tracks(&old, &new);

        assert_eq!(added.len(), 2);
        assert!(removed.is_empty());
        assert!(modified.is_empty());
    }

    #[test]
    fn test_all_tracks_removed() {
        let old = vec![
            track("1", "Bass", TrackType::Midi, vec![]),
            track("2", "Drums", TrackType::Midi, vec![]),
        ];
        let new = vec![];

        let (added, removed, modified) = diff_tracks(&old, &new);

        assert!(added.is_empty());
        assert_eq!(removed.len(), 2);
        assert!(modified.is_empty());
    }
}
