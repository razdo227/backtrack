use backtrack_parser::parse_file;
use std::path::PathBuf;

#[test]
fn parse_fixture() {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join("simple.als");

    let project = parse_file(path).expect("fixture should parse");
    assert_eq!(project.tracks.len(), 2);
    assert_eq!(project.tracks[0].name, "Bass");
    assert_eq!(
        project.tracks[1].track_type,
        backtrack_parser::TrackType::Midi
    );
}
