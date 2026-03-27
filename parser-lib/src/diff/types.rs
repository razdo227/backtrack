use crate::types::{Device, SampleRef, Track};
use serde::{Deserialize, Serialize};

/// Represents the complete diff between two Ableton projects
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct ProjectDiff {
    /// Tracks that were added in the new version
    pub tracks_added: Vec<Track>,
    /// Tracks that were removed from the old version
    pub tracks_removed: Vec<Track>,
    /// Tracks that exist in both but have modifications
    pub tracks_modified: Vec<TrackModification>,
    /// Changes to the master track
    pub master_changes: Vec<MasterChange>,
    /// Tempo change: (old, new)
    pub tempo_changed: Option<(Option<f32>, Option<f32>)>,
    /// Time signature change: (old, new)
    pub time_signature_changed: Option<(Option<(u8, u8)>, Option<(u8, u8)>)>,
    /// Sample references added
    pub sample_refs_added: Vec<SampleRef>,
    /// Sample references removed
    pub sample_refs_removed: Vec<SampleRef>,
}

/// Represents modifications to a single track
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrackModification {
    /// The track ID for identification
    pub track_id: String,
    /// Original name in the old version
    pub old_name: String,
    /// New name in the new version
    pub new_name: String,
    /// Whether the track was renamed
    pub name_changed: bool,
    /// Color change: (old_color, new_color) if changed
    pub color_changed: Option<(Option<u8>, Option<u8>)>,
    /// Devices that were added to this track
    pub devices_added: Vec<Device>,
    /// Devices that were removed from this track
    pub devices_removed: Vec<Device>,
}

/// Changes to the master track
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MasterChange {
    /// A device was added to the master track
    DeviceAdded(Device),
    /// A device was removed from the master track
    DeviceRemoved(Device),
}

impl ProjectDiff {
    /// Returns true if there are no changes between the projects
    pub fn is_empty(&self) -> bool {
        self.tracks_added.is_empty()
            && self.tracks_removed.is_empty()
            && self.tracks_modified.is_empty()
            && self.master_changes.is_empty()
            && self.tempo_changed.is_none()
            && self.time_signature_changed.is_none()
            && self.sample_refs_added.is_empty()
            && self.sample_refs_removed.is_empty()
    }

    /// Returns the total number of changes across all categories
    pub fn change_count(&self) -> usize {
        self.tracks_added.len()
            + self.tracks_removed.len()
            + self.tracks_modified.len()
            + self.master_changes.len()
            + if self.tempo_changed.is_some() { 1 } else { 0 }
            + if self.time_signature_changed.is_some() {
                1
            } else {
                0
            }
            + self.sample_refs_added.len()
            + self.sample_refs_removed.len()
    }

    /// Returns true if there are any track additions
    pub fn has_additions(&self) -> bool {
        !self.tracks_added.is_empty()
    }

    /// Returns true if there are any track removals
    pub fn has_removals(&self) -> bool {
        !self.tracks_removed.is_empty()
    }

    /// Returns true if there are any track modifications
    pub fn has_modifications(&self) -> bool {
        !self.tracks_modified.is_empty()
    }

    /// Returns true if there are any master track changes
    pub fn has_master_changes(&self) -> bool {
        !self.master_changes.is_empty()
    }
}

impl TrackModification {
    /// Returns true if this modification has any actual changes
    pub fn has_changes(&self) -> bool {
        self.name_changed
            || self.color_changed.is_some()
            || !self.devices_added.is_empty()
            || !self.devices_removed.is_empty()
    }

    /// Returns the total number of changes in this track modification
    pub fn change_count(&self) -> usize {
        let mut count = 0;
        if self.name_changed {
            count += 1;
        }
        if self.color_changed.is_some() {
            count += 1;
        }
        count += self.devices_added.len();
        count += self.devices_removed.len();
        count
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::TrackType;

    #[test]
    fn test_empty_diff() {
        let diff = ProjectDiff {
            tracks_added: vec![],
            tracks_removed: vec![],
            tracks_modified: vec![],
            master_changes: vec![],
            ..Default::default()
        };

        assert!(diff.is_empty());
        assert_eq!(diff.change_count(), 0);
        assert!(!diff.has_additions());
        assert!(!diff.has_removals());
        assert!(!diff.has_modifications());
        assert!(!diff.has_master_changes());
    }

    #[test]
    fn test_diff_with_additions() {
        let track = Track {
            id: Some("1".to_string()),
            track_type: TrackType::Midi,
            name: "Bass".to_string(),
            color: None,
            devices: vec![],
        };

        let diff = ProjectDiff {
            tracks_added: vec![track],
            tracks_removed: vec![],
            tracks_modified: vec![],
            master_changes: vec![],
            ..Default::default()
        };

        assert!(!diff.is_empty());
        assert_eq!(diff.change_count(), 1);
        assert!(diff.has_additions());
    }

    #[test]
    fn test_track_modification_has_changes() {
        let mod_with_changes = TrackModification {
            track_id: "1".to_string(),
            old_name: "Bass".to_string(),
            new_name: "Bass Line".to_string(),
            name_changed: true,
            color_changed: None,
            devices_added: vec![],
            devices_removed: vec![],
        };

        assert!(mod_with_changes.has_changes());
        assert_eq!(mod_with_changes.change_count(), 1);

        let mod_without_changes = TrackModification {
            track_id: "1".to_string(),
            old_name: "Bass".to_string(),
            new_name: "Bass".to_string(),
            name_changed: false,
            color_changed: None,
            devices_added: vec![],
            devices_removed: vec![],
        };

        assert!(!mod_without_changes.has_changes());
        assert_eq!(mod_without_changes.change_count(), 0);
    }
}
