use flate2::write::GzEncoder;
use flate2::Compression;
use std::fs;
use std::io::Write;
use std::path::PathBuf;

fn build_xml() -> String {
    r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" MinorVersion="11.3.4" Creator="Ableton Live 11.3.4">
  <LiveSet>
    <Tracks>
      <AudioTrack Id="0">
        <Name><EffectiveName Value="Bass" /></Name>
        <Color Value="16" />
        <DeviceChain>
          <Devices>
            <AudioEffectGroupDevice><UserName Value="EQ Eight" /></AudioEffectGroupDevice>
            <PluginDevice><PluginDesc><VstPluginInfo><PlugName Value="Serum" /></VstPluginInfo></PluginDesc></PluginDevice>
          </Devices>
        </DeviceChain>
      </AudioTrack>
      <MidiTrack Id="1">
        <Name><EffectiveName Value="Drums" /></Name>
        <DeviceChain><Devices><InstrumentGroupDevice><UserName Value="Drum Rack" /></InstrumentGroupDevice></Devices></DeviceChain>
      </MidiTrack>
    </Tracks>
    <MasterTrack><Name><EffectiveName Value="Master" /></Name></MasterTrack>
  </LiveSet>
</Ableton>
"#
    .to_string()
}

#[test]
#[ignore = "utility to regenerate fixtures only when needed"]
fn regenerate_simple_fixture() {
    let xml = build_xml();
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(xml.as_bytes()).unwrap();
    let compressed = encoder.finish().unwrap();

    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join("simple.als");
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(&path, compressed).unwrap();
}
