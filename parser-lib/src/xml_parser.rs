use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;

use crate::error::ParserError;
use crate::types::{
    AbletonProject, AbletonVersion, Device, DeviceType, ParseOptions, SampleRef, Track, TrackType,
};

pub(crate) fn parse_xml(xml: &str, options: &ParseOptions) -> Result<AbletonProject, ParserError> {
    let mut reader = Reader::from_str(xml);
    reader.trim_text(true);

    let mut buf = Vec::new();
    let mut version: Option<AbletonVersion> = None;
    let mut tracks: Vec<Track> = Vec::new();
    let mut master_track: Option<Track> = None;
    let mut sample_refs: Vec<SampleRef> = Vec::new();
    let mut tempo: Option<f32> = None;
    let mut time_signature: Option<(u8, u8)> = None;

    loop {
        match reader.read_event_into(&mut buf)? {
            Event::Start(e) => match e.name().as_ref() {
                b"Ableton" => {
                    let parsed_version = parse_version(&reader, &e)?;
                    if options.strict && !is_supported_version(&parsed_version) {
                        return Err(ParserError::UnsupportedVersion {
                            major: parsed_version.major,
                            minor: parsed_version.minor.clone(),
                        });
                    }
                    version = Some(parsed_version);
                }
                b"AudioTrack" => {
                    let track = parse_track(
                        &mut reader,
                        &e,
                        TrackType::Audio,
                        options,
                        &mut sample_refs,
                        &mut tempo,
                        &mut time_signature,
                    )?;
                    push_track(&mut tracks, track, options)?;
                }
                b"MidiTrack" => {
                    let track = parse_track(
                        &mut reader,
                        &e,
                        TrackType::Midi,
                        options,
                        &mut sample_refs,
                        &mut tempo,
                        &mut time_signature,
                    )?;
                    push_track(&mut tracks, track, options)?;
                }
                b"ReturnTrack" => {
                    let track = parse_track(
                        &mut reader,
                        &e,
                        TrackType::Return,
                        options,
                        &mut sample_refs,
                        &mut tempo,
                        &mut time_signature,
                    )?;
                    push_track(&mut tracks, track, options)?;
                }
                b"GroupTrack" => {
                    let track = parse_track(
                        &mut reader,
                        &e,
                        TrackType::Group,
                        options,
                        &mut sample_refs,
                        &mut tempo,
                        &mut time_signature,
                    )?;
                    push_track(&mut tracks, track, options)?;
                }
                b"MasterTrack" => {
                    let track = parse_track(
                        &mut reader,
                        &e,
                        TrackType::Master,
                        options,
                        &mut sample_refs,
                        &mut tempo,
                        &mut time_signature,
                    )?;
                    master_track = Some(track);
                }
                _ => {}
            },
            Event::Empty(e) => {
                if e.name().as_ref() == b"Ableton" {
                    let parsed_version = parse_version(&reader, &e)?;
                    if options.strict && !is_supported_version(&parsed_version) {
                        return Err(ParserError::UnsupportedVersion {
                            major: parsed_version.major,
                            minor: parsed_version.minor.clone(),
                        });
                    }
                    version = Some(parsed_version);
                }
            }
            Event::Eof => break,
            _ => {}
        }
        buf.clear();
    }

    let version =
        version.ok_or_else(|| ParserError::MissingRequiredElement("Ableton header".to_string()))?;

    Ok(AbletonProject {
        version,
        tracks,
        master_track,
        tempo,
        time_signature,
        sample_references: sample_refs,
    })
}

fn push_track(
    target: &mut Vec<Track>,
    track: Track,
    options: &ParseOptions,
) -> Result<(), ParserError> {
    if let Some(limit) = options.max_tracks {
        if target.len() >= limit {
            return Err(ParserError::LimitExceeded {
                item: "tracks",
                count: target.len() + 1,
                limit,
            });
        }
    }
    target.push(track);
    Ok(())
}

fn parse_version(
    reader: &Reader<&[u8]>,
    start: &BytesStart,
) -> Result<AbletonVersion, ParserError> {
    let major = attr_value(reader, start, b"MajorVersion")?
        .ok_or_else(|| ParserError::MissingRequiredElement("Ableton MajorVersion".to_string()))?;
    let major: u8 = major
        .parse()
        .map_err(|_| ParserError::InvalidFormat(format!("invalid MajorVersion '{major}'")))?;

    let minor = attr_value(reader, start, b"MinorVersion")?.unwrap_or_else(|| "0".to_string());
    let creator = attr_value(reader, start, b"Creator")?;

    Ok(AbletonVersion {
        major,
        minor,
        creator,
    })
}

fn is_supported_version(version: &AbletonVersion) -> bool {
    matches!(version.major, 4 | 5 | 6)
}

fn parse_track(
    reader: &mut Reader<&[u8]>,
    start: &BytesStart,
    track_type: TrackType,
    options: &ParseOptions,
    sample_refs: &mut Vec<SampleRef>,
    tempo: &mut Option<f32>,
    time_signature: &mut Option<(u8, u8)>,
) -> Result<Track, ParserError> {
    let track_id = attr_value(reader, start, b"Id")?;

    let mut name: Option<String> = None;
    let mut color: Option<u8> = None;
    let mut devices: Vec<Device> = Vec::new();
    let mut depth: usize = 0;

    let track_tag = start.name().as_ref().to_vec();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf)? {
            Event::Start(e) => {
                let tag = e.name().as_ref().to_vec();
                if e.name().as_ref() == b"FileRef" {
                    let file_ref = parse_file_ref(reader, &e)?;
                    sample_refs.push(file_ref);
                } else if depth == 0 {
                    match tag.as_slice() {
                        b"Name" => {
                            let parsed = parse_name_block(reader)?;
                            if name.is_none() && parsed.is_some() {
                                name = parsed;
                            }
                        }
                        b"Color" => {
                            if color.is_none() {
                                color = parse_color_block(reader, &e)?;
                            } else {
                                skip_element(reader, e.name().as_ref().to_vec(), sample_refs)?;
                            }
                        }
                        b"DeviceChain" => {
                            let parsed_devices = parse_device_chain(reader, options, sample_refs)?;
                            devices.extend(parsed_devices);
                        }
                        _ => {
                            // Check for Tempo/TimeSig if MasterTrack
                            // This usually lives in DeviceChain -> Mixer, but since we recurse into DeviceChain,
                            // we might miss it if we don't handle Mixer explicitly there.
                            // However, skipping usually consumes.
                            // Let's rely on SampleRef scanning via skip_element for now.
                            // But for Tempo/TimeSig we need values.
                            // Scan specifically for MasterTrack?

                            // Simplification: for Tempo/TimeSig we need to catch them wherever they are?
                            // No, they are specific.
                            // Let's just catch them here if we are top level of track?
                            // They are DEEP.
                            // Using skip_element (which now scans for SampleRef) is fine for samples.
                            // For Tempo, we need to parse.
                            // Let's implement a 'parse_mixer' if we want to be correct,
                            // Oooor, just look for "Tempo" tag globally? No, only in Master.
                            // Let's change skip_element to also accept a wildcard callback? Start with simple.

                            if track_type == TrackType::Master {
                                // If we don't have a parse_mixer, we must enter the element manually.
                                depth += 1; // Enter unknown elements to traverse them
                            } else {
                                depth += 1;
                            }
                        }
                    }
                } else {
                    // Start of nested element
                    // Check for Tempo/TimeSig if Master
                    if track_type == TrackType::Master {
                        match tag.as_slice() {
                            b"Tempo" => {
                                // Parse Tempo block
                                // <Tempo><Manual><Value>120</Value>...</Manual></Tempo>
                                // We can use a quick local parser or just manual loop
                                let val = parse_tempo_block(reader)?;
                                *tempo = Some(val);
                            }
                            b"TimeSignature" => {
                                let val = parse_time_sig_block(reader)?;
                                *time_signature = Some(val);
                            }
                            _ => {
                                depth += 1;
                            }
                        }
                    } else {
                        depth += 1;
                    }
                }
            }
            Event::Empty(e) => match e.name().as_ref() {
                b"Color" => {
                    if color.is_none() {
                        color = parse_color_from_attrs(&reader, &e);
                    }
                }
                b"EffectiveName" | b"UserName" => {
                    if name.is_none() {
                        name = attr_value(&reader, &e, b"Value")?;
                    }
                }
                _ => {}
            },
            Event::End(e) if e.name().as_ref() == track_tag.as_slice() => break,
            Event::End(_) => {
                if depth > 0 {
                    depth -= 1;
                }
            }
            Event::Eof => {
                return Err(ParserError::InvalidFormat(format!(
                    "unexpected EOF while parsing track ({:?})",
                    track_tag
                )))
            }
            _ => {}
        }
        buf.clear();
    }

    if let Some(limit) = options.max_devices_per_track {
        if devices.len() > limit {
            // ... error
        }
    }

    Ok(Track {
        id: track_id,
        track_type,
        name: name.unwrap_or_else(|| "Unnamed Track".to_string()),
        color,
        devices,
    })
}

fn parse_name_block(reader: &mut Reader<&[u8]>) -> Result<Option<String>, ParserError> {
    let mut name: Option<String> = None;
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf)? {
            Event::Empty(e) | Event::Start(e) => match e.name().as_ref() {
                b"EffectiveName" | b"UserName" => {
                    if let Some(val) = attr_value(&reader, &e, b"Value")? {
                        if name.is_none() || !val.is_empty() {
                            name = Some(val);
                            if std::env::var("BACKTRACK_DEBUG").is_ok() {}
                        }
                    }
                }
                _ => {}
            },
            Event::End(e) if e.name().as_ref() == b"Name" => break,
            Event::Eof => {
                return Err(ParserError::InvalidFormat(
                    "unexpected EOF while parsing <Name>".to_string(),
                ))
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(name)
}

fn parse_color_block(
    reader: &mut Reader<&[u8]>,
    start: &BytesStart,
) -> Result<Option<u8>, ParserError> {
    if let Some(color) = parse_color_from_attrs(reader, start) {
        // If the color is encoded directly on the start tag, consume until the end of the block.
        skip_element(reader, start.name().as_ref().to_vec(), &mut Vec::new())?;
        return Ok(Some(color));
    }

    let mut color = None;
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf)? {
            Event::Empty(e) | Event::Start(e) => match e.name().as_ref() {
                b"EffectiveColor" | b"Color" => {
                    if color.is_none() {
                        color = parse_color_from_attrs(&reader, &e);
                    }
                }
                _ => {}
            },
            Event::End(e) if e.name().as_ref() == b"Color" => break,
            Event::Eof => {
                return Err(ParserError::InvalidFormat(
                    "unexpected EOF while parsing <Color>".to_string(),
                ))
            }
            _ => {}
        }
        buf.clear();
    }
    Ok(color)
}

fn parse_device_chain(
    reader: &mut Reader<&[u8]>,
    options: &ParseOptions,
    sample_refs: &mut Vec<SampleRef>,
) -> Result<Vec<Device>, ParserError> {
    let mut devices = Vec::new();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf)? {
            Event::Start(e) => {
                let tag = e.name().as_ref().to_vec();
                if tag.as_slice() == b"Devices" {
                    let parsed = parse_devices(reader, options, sample_refs)?;
                    devices.extend(parsed);
                } else if tag.as_slice() == b"DeviceChain" {
                    let nested = parse_device_chain(reader, options, sample_refs)?;
                    devices.extend(nested);
                } else {
                    skip_element(reader, tag, sample_refs)?;
                }
            }
            Event::End(e) if e.name().as_ref() == b"DeviceChain" => break,
            Event::Eof => {
                return Err(ParserError::InvalidFormat(
                    "unexpected EOF while parsing <DeviceChain>".to_string(),
                ))
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(devices)
}

fn parse_devices(
    reader: &mut Reader<&[u8]>,
    options: &ParseOptions,
    sample_refs: &mut Vec<SampleRef>,
) -> Result<Vec<Device>, ParserError> {
    let mut devices = Vec::new();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf)? {
            Event::Start(e) => {
                if is_device_tag(e.name().as_ref()) {
                    let device = parse_device(reader, &e, sample_refs)?;
                    if let Some(limit) = options.max_devices_per_track {
                        if devices.len() >= limit {
                            return Err(ParserError::LimitExceeded {
                                item: "devices",
                                count: devices.len() + 1,
                                limit,
                            });
                        }
                    }
                    devices.push(device);
                } else {
                    skip_element(reader, e.name().as_ref().to_vec(), sample_refs)?;
                }
            }
            Event::Empty(e) => {
                if is_device_tag(e.name().as_ref()) {
                    let element_name = e.name().as_ref().to_vec();
                    let device_type = classify_device_tag(element_name.as_ref());
                    let name = attr_value(&reader, &e, b"UserName")?
                        .or_else(|| attr_value(&reader, &e, b"EffectiveName").ok().flatten())
                        .unwrap_or_else(|| fallback_device_name(element_name.as_ref()));

                    if let Some(limit) = options.max_devices_per_track {
                        if devices.len() >= limit {
                            return Err(ParserError::LimitExceeded {
                                item: "devices",
                                count: devices.len() + 1,
                                limit,
                            });
                        }
                    }

                    devices.push(Device { name, device_type });
                }
            }
            Event::End(e) if e.name().as_ref() == b"Devices" => break,
            Event::Eof => {
                return Err(ParserError::InvalidFormat(
                    "unexpected EOF while parsing <Devices>".to_string(),
                ))
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(devices)
}

fn parse_device(
    reader: &mut Reader<&[u8]>,
    start: &BytesStart,
    sample_refs: &mut Vec<SampleRef>,
) -> Result<Device, ParserError> {
    let element_name = start.name().as_ref().to_vec();
    let mut buf = Vec::new();

    let mut device_type = classify_device_tag(element_name.as_ref());
    let mut name = attr_value(&reader, start, b"UserName")?;
    let mut inside_plugin_info = false;

    loop {
        match reader.read_event_into(&mut buf)? {
            Event::Start(e) => {
                match e.name().as_ref() {
                    b"UserName" | b"EffectiveName" => {
                        if let Some(val) = attr_value(&reader, &e, b"Value")? {
                            if name.is_none() || !val.is_empty() {
                                name = Some(val);
                            }
                        }
                    }
                    b"PlugName" | b"OriginalPlugName" => {
                        if let Some(val) = attr_value(&reader, &e, b"Value")? {
                            if name.is_none() || !val.is_empty() {
                                name = Some(val);
                            }
                        }
                    }
                    b"Name" => {
                        // VST3 and other plugins may use <Name Value="..."/> within plugin info blocks
                        if inside_plugin_info {
                            if let Some(val) = attr_value(&reader, &e, b"Value")? {
                                if name.is_none() || !val.is_empty() {
                                    name = Some(val);
                                }
                            }
                        }
                    }
                    b"VstPluginInfo" => {
                        device_type = DeviceType::VstPlugin;
                        inside_plugin_info = true;
                    }
                    b"Vst3PluginInfo" => {
                        device_type = DeviceType::Vst3Plugin;
                        inside_plugin_info = true;
                    }
                    b"AuPluginInfo" => {
                        device_type = DeviceType::AudioUnitPlugin;
                        inside_plugin_info = true;
                    }
                    b"FileRef" => {
                        let file_ref = parse_file_ref(reader, &e)?;
                        sample_refs.push(file_ref);
                    }
                    _ => {
                        // For other nested nodes we just keep streaming; the loop will hit the device end marker.
                    }
                }
            }
            Event::Empty(e) => match e.name().as_ref() {
                b"UserName" | b"EffectiveName" | b"PlugName" | b"OriginalPlugName" => {
                    if let Some(val) = attr_value(&reader, &e, b"Value")? {
                        if name.is_none() || !val.is_empty() {
                            name = Some(val);
                        }
                    }
                }
                b"Name" => {
                    // VST3 and other plugins may use <Name Value="..."/> within plugin info blocks
                    if inside_plugin_info {
                        if let Some(val) = attr_value(&reader, &e, b"Value")? {
                            if name.is_none() || !val.is_empty() {
                                name = Some(val);
                            }
                        }
                    }
                }
                b"VstPluginInfo" => {
                    device_type = DeviceType::VstPlugin;
                    inside_plugin_info = true;
                }
                b"Vst3PluginInfo" => {
                    device_type = DeviceType::Vst3Plugin;
                    inside_plugin_info = true;
                }
                b"AuPluginInfo" => {
                    device_type = DeviceType::AudioUnitPlugin;
                    inside_plugin_info = true;
                }
                _ => {}
            },
            Event::End(e) => {
                if e.name().as_ref() == b"VstPluginInfo"
                    || e.name().as_ref() == b"Vst3PluginInfo"
                    || e.name().as_ref() == b"AuPluginInfo"
                {
                    inside_plugin_info = false;
                } else if e.name().as_ref() == element_name.as_slice() {
                    break;
                }
            }
            Event::Text(t) => {
                if name.is_none() {
                    let text = t.unescape().map_err(|e| {
                        ParserError::Xml(format!("failed to read device text: {e}"))
                    })?;
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        name = Some(trimmed.to_string());
                    }
                }
            }
            Event::Eof => {
                return Err(ParserError::InvalidFormat(
                    "unexpected EOF while parsing device".to_string(),
                ))
            }
            _ => {}
        }
        buf.clear();
    }

    let name = match name {
        Some(n) if !n.is_empty() => n,
        _ => fallback_device_name(element_name.as_ref()),
    };
    Ok(Device { name, device_type })
}

fn parse_color_from_attrs(reader: &Reader<&[u8]>, element: &BytesStart) -> Option<u8> {
    attr_value(reader, element, b"Value")
        .ok()
        .flatten()
        .and_then(|v| v.parse::<u8>().ok())
}

fn attr_value(
    reader: &Reader<&[u8]>,
    element: &BytesStart,
    attr_name: &[u8],
) -> Result<Option<String>, ParserError> {
    match element.try_get_attribute(attr_name) {
        Ok(Some(attr)) => {
            let val = attr
                .decode_and_unescape_value(reader)
                .map_err(|e| ParserError::Xml(format!("failed to decode attribute: {e}")))?
                .into_owned();
            Ok(Some(val))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(ParserError::Xml(format!(
            "failed to read attribute {:?}: {e}",
            String::from_utf8_lossy(attr_name)
        ))),
    }
}

fn classify_device_tag(tag: &[u8]) -> DeviceType {
    let lower = String::from_utf8_lossy(tag).to_lowercase();
    if lower.contains("plugindevice") {
        // PluginDevice is a generic container - actual type determined by nested PluginInfo
        DeviceType::Unknown
    } else if lower.contains("au") {
        DeviceType::AudioUnitPlugin
    } else if lower.contains("drum") || lower.contains("rack") || lower.contains("group") {
        DeviceType::Rack
    } else if lower.contains("instrument") {
        DeviceType::NativeInstrument
    } else if lower.contains("effect") {
        DeviceType::NativeEffect
    } else if lower.contains("plugin") {
        DeviceType::VstPlugin
    } else {
        DeviceType::Unknown
    }
}

fn is_device_tag(tag: &[u8]) -> bool {
    tag.ends_with(b"Device")
        || matches!(
            tag,
            b"PluginDevice"
                | b"AudioEffectGroupDevice"
                | b"InstrumentGroupDevice"
                | b"MidiEffectGroupDevice"
        )
}

fn fallback_device_name(tag: &[u8]) -> String {
    let raw = String::from_utf8_lossy(tag);
    let cleaned = raw.replace("Device", "").replace('_', " ");
    let trimmed = cleaned.trim();
    if trimmed.is_empty() {
        "Unknown Device".to_string()
    } else {
        trimmed.to_string()
    }
}

fn skip_element(
    reader: &mut Reader<&[u8]>,
    target: Vec<u8>,
    sample_refs: &mut Vec<SampleRef>,
) -> Result<(), ParserError> {
    let mut depth = 0usize;
    let mut buf = Vec::new();
    let target_slice = target.as_slice();

    loop {
        match reader.read_event_into(&mut buf)? {
            Event::Start(e) => {
                if e.name().as_ref() == b"FileRef" {
                    let file_ref = parse_file_ref(reader, &e)?;
                    sample_refs.push(file_ref);
                    // parse_file_ref consumes the end tag of FileRef, so we don't increment depth for it?
                    // Wait, parse_file_ref loop breaks on Event::End(FileRef).
                    // So we are back in this loop.
                    // But we just consumed the FileRef element.
                    // We need to NOT increment depth for the *child* we just parsed.
                    // Correct.
                } else if e.name().as_ref() == target_slice {
                    depth += 1;
                } else {
                    depth += 1;
                }
            }
            Event::End(e) => {
                if e.name().as_ref() == target_slice {
                    if depth == 0 {
                        break;
                    }
                    depth -= 1;
                } else {
                    if depth > 0 {
                        depth -= 1;
                    }
                }
            }
            Event::Eof => {
                return Err(ParserError::InvalidFormat(format!(
                    "unexpected EOF while skipping element {:?}",
                    String::from_utf8_lossy(&target)
                )))
            }
            _ => {}
        }
        buf.clear();
    }
    Ok(())
}

fn parse_file_ref(
    reader: &mut Reader<&[u8]>,
    start: &BytesStart,
) -> Result<SampleRef, ParserError> {
    // <FileRef> contains <Name Value="..."/>, <RelativePath .../>, etc.
    // Or sometimes attributes directly? Usually child elements in Ableton XML.

    let mut file_name = String::new();
    let mut relative_path = None;
    let mut original_file_size = None;
    let mut buf = Vec::new();

    let target_tag = start.name().as_ref().to_vec();

    loop {
        match reader.read_event_into(&mut buf)? {
            Event::Empty(e) | Event::Start(e) => match e.name().as_ref() {
                b"Name" => {
                    if let Some(val) = attr_value(&reader, &e, b"Value")? {
                        file_name = val;
                    }
                }
                b"RelativePath" => {
                    if let Some(val) = attr_value(&reader, &e, b"Value")? {
                        relative_path = Some(val);
                    }
                }
                b"OriginalFileSize" => {
                    if let Some(val) = attr_value(&reader, &e, b"Value")? {
                        original_file_size = val.parse().ok();
                    }
                }
                _ => {}
            },
            Event::End(e) if e.name().as_ref() == target_tag.as_slice() => break,
            Event::Eof => {
                return Err(ParserError::InvalidFormat(
                    "unexpected EOF while parsing <FileRef>".to_string(),
                ))
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(SampleRef {
        file_name,
        relative_path,
        original_file_size,
    })
}

fn parse_tempo_block(reader: &mut Reader<&[u8]>) -> Result<f32, ParserError> {
    let mut tempo = 120.0;
    let mut buf = Vec::new();
    let mut depth = 0;

    loop {
        match reader.read_event_into(&mut buf)? {
            Event::Start(e) => {
                if e.name().as_ref() == b"Manual" {
                    depth += 1;
                } else if e.name().as_ref() == b"Value" {
                } else {
                    depth += 1;
                }
            }
            Event::Text(e) => {
                let text = e.unescape().map_err(|e| ParserError::Xml(e.to_string()))?;
                if let Ok(val) = text.trim().parse::<f32>() {
                    if val > 10.0 && val < 999.0 {
                        tempo = val;
                    }
                }
            }
            Event::Empty(e) => {
                if e.name().as_ref() == b"Value" || e.name().as_ref() == b"Manual" {
                    if let Some(val) = attr_value(reader, &e, b"Value")? {
                        if let Ok(f) = val.parse::<f32>() {
                            tempo = f;
                        }
                    }
                }
            }
            Event::End(e) => {
                if e.name().as_ref() == b"Tempo" {
                    break;
                }
                if depth > 0 {
                    depth -= 1;
                }
            }
            _ => {}
        }
        buf.clear();
    }
    Ok(tempo)
}

fn parse_time_sig_block(reader: &mut Reader<&[u8]>) -> Result<(u8, u8), ParserError> {
    let mut num = 4;
    let denom = 4;
    let mut buf = Vec::new();
    let mut depth = 0;

    loop {
        match reader.read_event_into(&mut buf)? {
            Event::Start(_e) => {
                depth += 1;
            }
            Event::Text(e) => {
                let text = e.unescape().map_err(|e| ParserError::Xml(e.to_string()))?;
                if let Ok(val) = text.trim().parse::<u8>() {
                    if val >= 1 && val <= 32 {
                        num = val;
                    }
                }
            }
            Event::End(e) => {
                if e.name().as_ref() == b"TimeSignature" {
                    break;
                }
                if depth > 0 {
                    depth -= 1;
                }
            }
            _ => {}
        }
        buf.clear();
    }
    Ok((num, denom))
}
