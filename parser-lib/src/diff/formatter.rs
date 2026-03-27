use super::types::{MasterChange, ProjectDiff};

/// Format a ProjectDiff into a human-readable string with emoji indicators
///
/// Output format:
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
///     - Color changed
///     - Added: Compressor
///     - Removed: EQ Eight
///
/// 🎛️  MASTER
///   • Added: Limiter
/// ```
pub fn format_diff(diff: &ProjectDiff) -> String {
    if diff.is_empty() {
        return "No changes detected.".to_string();
    }

    let mut output = String::new();

    // Add separator
    output.push_str("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Format added tracks
    if !diff.tracks_added.is_empty() {
        output.push_str(&format!("✅ ADDED ({})\n", diff.tracks_added.len()));
        for track in &diff.tracks_added {
            output.push_str(&format!(
                "  • \"{}\" ({:?})\n",
                track.name, track.track_type
            ));
        }
        output.push('\n');
    }

    // Format removed tracks
    if !diff.tracks_removed.is_empty() {
        output.push_str(&format!("❌ REMOVED ({})\n", diff.tracks_removed.len()));
        for track in &diff.tracks_removed {
            output.push_str(&format!(
                "  • \"{}\" ({:?})\n",
                track.name, track.track_type
            ));
        }
        output.push('\n');
    }

    // Format modified tracks
    if !diff.tracks_modified.is_empty() {
        output.push_str(&format!("📝 MODIFIED ({})\n", diff.tracks_modified.len()));
        for modification in &diff.tracks_modified {
            // Track name (show rename if applicable)
            if modification.name_changed {
                output.push_str(&format!(
                    "  • \"{}\" → \"{}\"\n",
                    modification.old_name, modification.new_name
                ));
            } else {
                output.push_str(&format!("  • \"{}\"\n", modification.old_name));
            }

            // Color change
            if let Some((old_color, new_color)) = modification.color_changed {
                output.push_str(&format!(
                    "    - Color: {} → {}\n",
                    format_color(old_color),
                    format_color(new_color)
                ));
            }

            // Added devices
            for device in &modification.devices_added {
                output.push_str(&format!("    - Added: {}\n", device.name));
            }

            // Removed devices
            for device in &modification.devices_removed {
                output.push_str(&format!("    - Removed: {}\n", device.name));
            }
        }
        output.push('\n');
    }

    // Format master track changes
    if !diff.master_changes.is_empty() {
        output.push_str(&format!("🎛️  MASTER ({})\n", diff.master_changes.len()));
        for change in &diff.master_changes {
            match change {
                MasterChange::DeviceAdded(device) => {
                    output.push_str(&format!("  • Added: {}\n", device.name));
                }
                MasterChange::DeviceRemoved(device) => {
                    output.push_str(&format!("  • Removed: {}\n", device.name));
                }
            }
        }
        output.push('\n');
    }

    // Format global changes
    if diff.tempo_changed.is_some() || diff.time_signature_changed.is_some() {
        output.push_str("🌍 GLOBAL\n");
        if let Some((old, new)) = diff.tempo_changed {
            let old_s = old.map(|v| format!("{:.1}", v)).unwrap_or("?".to_string());
            let new_s = new.map(|v| format!("{:.1}", v)).unwrap_or("?".to_string());
            output.push_str(&format!("  • Tempo: {} → {}\n", old_s, new_s));
        }
        if let Some((old, new)) = diff.time_signature_changed {
            let old_s = old
                .map(|(n, d)| format!("{}/{}", n, d))
                .unwrap_or("?".to_string());
            let new_s = new
                .map(|(n, d)| format!("{}/{}", n, d))
                .unwrap_or("?".to_string());
            output.push_str(&format!("  • Time Sig: {} → {}\n", old_s, new_s));
        }
        output.push('\n');
    }

    // Format sample changes
    if !diff.sample_refs_added.is_empty() || !diff.sample_refs_removed.is_empty() {
        let count = diff.sample_refs_added.len() + diff.sample_refs_removed.len();
        output.push_str(&format!("📂 SAMPLES ({})\n", count));

        for sample in &diff.sample_refs_added {
            output.push_str(&format!("  • Added: {}\n", sample.file_name));
        }
        for sample in &diff.sample_refs_removed {
            output.push_str(&format!("  • Removed: {}\n", sample.file_name));
        }
    }

    output
}

/// Format an optional color value for display
fn format_color(color: Option<u8>) -> String {
    match color {
        Some(c) => format!("{}", c),
        None => "None".to_string(),
    }
}

/// Generate a concise one-line summary
pub fn format_summary_line(diff: &ProjectDiff) -> String {
    if diff.is_empty() {
        return "No changes".to_string();
    }

    let mut parts = Vec::new();

    if !diff.tracks_added.is_empty() {
        parts.push(format!(
            "+{} track{}",
            diff.tracks_added.len(),
            if diff.tracks_added.len() == 1 {
                ""
            } else {
                "s"
            }
        ));
    }

    if !diff.tracks_removed.is_empty() {
        parts.push(format!(
            "-{} track{}",
            diff.tracks_removed.len(),
            if diff.tracks_removed.len() == 1 {
                ""
            } else {
                "s"
            }
        ));
    }

    if !diff.tracks_modified.is_empty() {
        parts.push(format!("~{} modified", diff.tracks_modified.len()));
    }

    if !diff.master_changes.is_empty() {
        parts.push(format!("⚡ master"));
    }

    if diff.tempo_changed.is_some() || diff.time_signature_changed.is_some() {
        parts.push("🌍 global".to_string());
    }

    let sample_changes = diff.sample_refs_added.len() + diff.sample_refs_removed.len();
    if sample_changes > 0 {
        parts.push(format!("📂 {} samples", sample_changes));
    }

    parts.join(", ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diff::types::TrackModification;
    use crate::types::{Device, DeviceType, Track, TrackType};

    fn track(name: &str, track_type: TrackType) -> Track {
        Track {
            id: Some("1".to_string()),
            track_type,
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
    fn test_format_empty_diff() {
        let diff = ProjectDiff {
            tracks_added: vec![],
            tracks_removed: vec![],
            tracks_modified: vec![],
            master_changes: vec![],
            ..Default::default()
        };

        let formatted = format_diff(&diff);
        assert_eq!(formatted, "No changes detected.");
    }

    #[test]
    fn test_format_track_added() {
        let diff = ProjectDiff {
            tracks_added: vec![track("Drums", TrackType::Midi)],
            tracks_removed: vec![],
            tracks_modified: vec![],
            master_changes: vec![],
            ..Default::default()
        };

        let formatted = format_diff(&diff);
        assert!(formatted.contains("✅ ADDED (1)"));
        assert!(formatted.contains("\"Drums\""));
    }

    #[test]
    fn test_format_track_removed() {
        let diff = ProjectDiff {
            tracks_added: vec![],
            tracks_removed: vec![track("Old Synth", TrackType::Audio)],
            tracks_modified: vec![],
            master_changes: vec![],
            ..Default::default()
        };

        let formatted = format_diff(&diff);
        assert!(formatted.contains("❌ REMOVED (1)"));
        assert!(formatted.contains("\"Old Synth\""));
    }

    #[test]
    fn test_format_track_renamed() {
        let modification = TrackModification {
            track_id: "1".to_string(),
            old_name: "Bass".to_string(),
            new_name: "Bass Line".to_string(),
            name_changed: true,
            color_changed: None,
            devices_added: vec![],
            devices_removed: vec![],
        };

        let diff = ProjectDiff {
            tracks_added: vec![],
            tracks_removed: vec![],
            tracks_modified: vec![modification],
            master_changes: vec![],
            ..Default::default()
        };

        let formatted = format_diff(&diff);
        assert!(formatted.contains("📝 MODIFIED (1)"));
        assert!(formatted.contains("\"Bass\" → \"Bass Line\""));
    }

    #[test]
    fn test_format_device_changes() {
        let modification = TrackModification {
            track_id: "1".to_string(),
            old_name: "Bass".to_string(),
            new_name: "Bass".to_string(),
            name_changed: false,
            color_changed: None,
            devices_added: vec![device("Compressor")],
            devices_removed: vec![device("EQ Eight")],
        };

        let diff = ProjectDiff {
            tracks_added: vec![],
            tracks_removed: vec![],
            tracks_modified: vec![modification],
            master_changes: vec![],
            ..Default::default()
        };

        let formatted = format_diff(&diff);
        assert!(formatted.contains("Added: Compressor"));
        assert!(formatted.contains("Removed: EQ Eight"));
    }

    #[test]
    fn test_format_master_changes() {
        let diff = ProjectDiff {
            tracks_added: vec![],
            tracks_removed: vec![],
            tracks_modified: vec![],
            master_changes: vec![MasterChange::DeviceAdded(device("Limiter"))],
            tempo_changed: None,
            time_signature_changed: None,
            sample_refs_added: vec![],
            sample_refs_removed: vec![],
        };

        let formatted = format_diff(&diff);
        assert!(formatted.contains("🎛️  MASTER"));
        assert!(formatted.contains("Added: Limiter"));
    }

    #[test]
    fn test_summary_line() {
        let diff = ProjectDiff {
            tracks_added: vec![track("A", TrackType::Midi)],
            tracks_removed: vec![track("B", TrackType::Audio)],
            tracks_modified: vec![],
            master_changes: vec![],
            ..Default::default()
        };

        let summary = format_summary_line(&diff);
        assert!(summary.contains("+1 track"));
        assert!(summary.contains("-1 track"));
    }
}
