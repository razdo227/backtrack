use backtrack_parser::parse_file;

fn main() {
    let path = std::env::args()
        .nth(1)
        .expect("usage: cargo run --example basic_usage <file.als>");

    let project = parse_file(&path).expect("failed to parse .als file");
    println!(
        "Ableton version: {}.{}",
        project.version.major, project.version.minor
    );
    if let Some(creator) = &project.version.creator {
        println!("Creator: {creator}");
    }
    println!("Tracks:");
    for track in &project.tracks {
        println!("  - {} ({:?})", track.name, track.track_type);
        for device in &track.devices {
            println!("    - {} [{:?}]", device.name, device.device_type);
        }
    }
}
