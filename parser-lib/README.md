# Backtrack Parser

Shared Ableton `.als` parser used by the Backtrack desktop (Tauri) and backend (Axum).

## What it does
- Decompresses gzipped `.als` files
- Streams the XML with `quick-xml` to keep memory low
- Extracts version info, tracks (audio/midi/return/master/group), colors, and devices
- Produces `AbletonProject` structs that serialize cleanly to JSON

## Supported Ableton versions
Best-effort parsing for Live 9–12 (`MajorVersion` 4–6). In `strict` mode the parser errors on unknown majors.

## Usage
```rust
use backtrack_parser::{parse_file, TrackType};

let project = parse_file("path/to/set.als")?;
println!("Creator: {:?}", project.version.creator);
for track in project.tracks {
    println!("Track {} ({:?})", track.name, track.track_type);
    for device in track.devices {
        println!("  - {}", device.name);
    }
}
```

### CLI
```
cargo run -p backtrack-parser --bin parse-als path/to/set.als
```

### Examples
```
cargo run -p backtrack-parser --example basic_usage
```

## Testing
```
cargo test -p backtrack-parser
```

`tests/fixtures/simple.als` provides a small real-world fixture; `tests/generate_fixtures.rs` can regenerate fixtures (`cargo test --test generate_fixtures -- --ignored`).
