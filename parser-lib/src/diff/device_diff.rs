use crate::types::Device;
use std::collections::HashMap;

/// Diff two device lists using multiset difference (count-based)
///
/// This handles duplicate devices correctly by tracking counts.
/// For example:
/// - Old: [EQ, EQ, Comp] → Added: [], Removed: []
/// - New: [EQ, EQ, EQ, Reverb] → Added: [EQ, Reverb], Removed: [Comp]
///
/// Returns: (devices_added, devices_removed)
pub fn diff_devices(old_devices: &[Device], new_devices: &[Device]) -> (Vec<Device>, Vec<Device>) {
    // Build count maps for old and new devices
    let old_counts = build_device_count_map(old_devices);
    let new_counts = build_device_count_map(new_devices);

    let mut added = Vec::new();
    let mut removed = Vec::new();

    // Find added devices (in new but not in old, or more in new than old)
    for (device_key, &new_count) in &new_counts {
        let old_count = old_counts.get(device_key).copied().unwrap_or(0);

        if new_count > old_count {
            // Find the actual device from new_devices
            if let Some(device) = find_device_by_key(new_devices, device_key) {
                // Add the difference count
                for _ in 0..(new_count - old_count) {
                    added.push(device.clone());
                }
            }
        }
    }

    // Find removed devices (in old but not in new, or more in old than new)
    for (device_key, &old_count) in &old_counts {
        let new_count = new_counts.get(device_key).copied().unwrap_or(0);

        if old_count > new_count {
            // Find the actual device from old_devices
            if let Some(device) = find_device_by_key(old_devices, device_key) {
                // Add the difference count
                for _ in 0..(old_count - new_count) {
                    removed.push(device.clone());
                }
            }
        }
    }

    (added, removed)
}

/// Build a count map for devices using (name, device_type) as key
fn build_device_count_map(devices: &[Device]) -> HashMap<DeviceKey, usize> {
    let mut counts = HashMap::new();

    for device in devices {
        let key = DeviceKey {
            name: device.name.clone(),
            device_type: device.device_type.clone(),
        };
        *counts.entry(key).or_insert(0) += 1;
    }

    counts
}

/// Find a device in the list that matches the given key
fn find_device_by_key<'a>(devices: &'a [Device], key: &DeviceKey) -> Option<&'a Device> {
    devices
        .iter()
        .find(|d| d.name == key.name && d.device_type == key.device_type)
}

/// Composite key for device identification (name + type)
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct DeviceKey {
    name: String,
    device_type: crate::types::DeviceType,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::DeviceType;

    fn device(name: &str, device_type: DeviceType) -> Device {
        Device {
            name: name.to_string(),
            device_type,
        }
    }

    #[test]
    fn test_no_changes() {
        let old = vec![
            device("EQ Eight", DeviceType::NativeEffect),
            device("Compressor", DeviceType::NativeEffect),
        ];
        let new = old.clone();

        let (added, removed) = diff_devices(&old, &new);

        assert!(added.is_empty());
        assert!(removed.is_empty());
    }

    #[test]
    fn test_device_added() {
        let old = vec![device("EQ Eight", DeviceType::NativeEffect)];
        let new = vec![
            device("EQ Eight", DeviceType::NativeEffect),
            device("Compressor", DeviceType::NativeEffect),
        ];

        let (added, removed) = diff_devices(&old, &new);

        assert_eq!(added.len(), 1);
        assert_eq!(added[0].name, "Compressor");
        assert!(removed.is_empty());
    }

    #[test]
    fn test_device_removed() {
        let old = vec![
            device("EQ Eight", DeviceType::NativeEffect),
            device("Compressor", DeviceType::NativeEffect),
        ];
        let new = vec![device("EQ Eight", DeviceType::NativeEffect)];

        let (added, removed) = diff_devices(&old, &new);

        assert!(added.is_empty());
        assert_eq!(removed.len(), 1);
        assert_eq!(removed[0].name, "Compressor");
    }

    #[test]
    fn test_duplicate_devices() {
        // Old: 2 EQs, New: 3 EQs → Added 1 EQ
        let old = vec![
            device("EQ Eight", DeviceType::NativeEffect),
            device("EQ Eight", DeviceType::NativeEffect),
        ];
        let new = vec![
            device("EQ Eight", DeviceType::NativeEffect),
            device("EQ Eight", DeviceType::NativeEffect),
            device("EQ Eight", DeviceType::NativeEffect),
        ];

        let (added, removed) = diff_devices(&old, &new);

        assert_eq!(added.len(), 1);
        assert_eq!(added[0].name, "EQ Eight");
        assert!(removed.is_empty());
    }

    #[test]
    fn test_all_devices_removed() {
        let old = vec![
            device("EQ Eight", DeviceType::NativeEffect),
            device("Compressor", DeviceType::NativeEffect),
        ];
        let new = vec![];

        let (added, removed) = diff_devices(&old, &new);

        assert!(added.is_empty());
        assert_eq!(removed.len(), 2);
    }

    #[test]
    fn test_all_devices_added() {
        let old = vec![];
        let new = vec![
            device("EQ Eight", DeviceType::NativeEffect),
            device("Compressor", DeviceType::NativeEffect),
        ];

        let (added, removed) = diff_devices(&old, &new);

        assert_eq!(added.len(), 2);
        assert!(removed.is_empty());
    }

    #[test]
    fn test_complex_changes() {
        let old = vec![
            device("EQ Eight", DeviceType::NativeEffect),
            device("EQ Eight", DeviceType::NativeEffect),
            device("Compressor", DeviceType::NativeEffect),
        ];
        let new = vec![
            device("EQ Eight", DeviceType::NativeEffect),
            device("Reverb", DeviceType::NativeEffect),
            device("Reverb", DeviceType::NativeEffect),
        ];

        let (added, removed) = diff_devices(&old, &new);

        // Removed: 1 EQ, 1 Compressor
        assert_eq!(removed.len(), 2);
        assert!(removed.iter().any(|d| d.name == "EQ Eight"));
        assert!(removed.iter().any(|d| d.name == "Compressor"));

        // Added: 2 Reverb
        assert_eq!(added.len(), 2);
        assert!(added.iter().all(|d| d.name == "Reverb"));
    }
}
