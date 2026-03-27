# Ableton `.als` parsing research (Backtrack)

> **Context:** This doc summarizes what we *can* rely on today based on the current parser-lib implementation and fixtures in this repo, plus common `.als` structure patterns. It’s meant as a practical reference for building semantic diffs.

## 1) File format overview

- `.als` files are **gzip-compressed XML**.
- The XML root is typically `<Ableton ...>` with attributes like:
  - `MajorVersion` (e.g., 4, 5, 6 corresponding roughly to Live 9–12)
  - `MinorVersion` (e.g., `11.3.4`)
  - `Creator` (e.g., `Ableton Live 11.3.4`)
- The main body is under `<LiveSet>`, with nodes such as `<Tracks>`, `<MasterTrack>`, device chains, clips, etc.

Minimal example (from repo fixture generator):

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
        <DeviceChain>
          <Devices>
            <InstrumentGroupDevice><UserName Value="Drum Rack" /></InstrumentGroupDevice>
          </Devices>
        </DeviceChain>
      </MidiTrack>
    </Tracks>
    <MasterTrack><Name><EffectiveName Value="Master" /></Name></MasterTrack>
  </LiveSet>
</Ableton>
```

## 2) What parser-lib currently extracts

From `parser-lib` (Rust):

- **Ableton version** from the `<Ableton>` root attributes.
- **Tracks**: Audio, MIDI, Return, Group, Master.
  - Track `Id` attribute (when present).
  - Track `Name` (via `<Name><EffectiveName Value="..."/></Name>` or similar).
  - Track `Color` (via `<Color Value="..."/>`).
  - Devices in each track’s `<DeviceChain><Devices>...`.
- **Devices**: derived from tag names and plugin info nodes:
  - `UserName`, `EffectiveName`, `PlugName`, `OriginalPlugName`, `Name` nodes are inspected.
  - Device type detection includes VST/VST3/AU, native devices, racks, etc.
- **Tempo** and **TimeSignature** (best-effort), mainly from Master context.
- **Sample references** via scanning **any** `<FileRef>` node in the XML.

**Important:** The parser *streams* XML with `quick-xml` and gathers `FileRef` references even while skipping unrelated elements.

## 3) Sample / asset references (FileRef)

The parser collects sample refs from any `<FileRef>` element it encounters. Current logic expects child elements like:

```xml
<FileRef>
  <Name Value="Kick.wav" />
  <RelativePath Value="Samples/Drums" />
  <OriginalFileSize Value="123456" />
</FileRef>
```

Extracted fields:

- `file_name` — from `<Name Value="..."/>`
- `relative_path` — from `<RelativePath Value="..."/>` (optional)
- `original_file_size` — from `<OriginalFileSize Value="..."/>` (optional)

**Implication:** we get *file-level* references without needing exact knowledge of clip vs device vs other attachment: if it’s encoded via `<FileRef>`, we see it.

## 4) Likely clip structure (for later expansion)

Not fully parsed yet, but typical Ableton XML often encodes clips inside track device chains or clip slots such as:

- `<ClipSlot>` → `<ClipSlot>` → `<Clip>` / `<AudioClip>` / `<MidiClip>`
- Sample references inside clip structures typically still reference `<FileRef>`.

**Actionable:** Since we’re already catching `<FileRef>` globally, we can defer deep clip parsing until we want musical-level diffs (clip length, warp mode, notes, etc.).

## 5) Proposed semantic diff approach

Goal: summarize “what changed” in a **producer-meaningful** way, not a raw XML diff.

### 5.1 Normalize → Compare

**Normalization step** (build a canonical `AbletonProject` representation):

1. **Decompress `.als` → XML** (gzip).
2. **Parse into project model** (version, tracks, devices, tempo, sample refs).
3. **Normalize** for diff stability:
   - Sort tracks by **track Id** if available; fall back to name+type.
   - Normalize device names (trim, lowercase for comparison, preserve display name for UI).
   - Normalize `SampleRef` paths: join `RelativePath + file_name`, normalize slashes, case-fold on Windows-ish volumes if needed.
   - Deduplicate repeated `FileRef`s (Ableton sometimes repeats references in multiple subtrees).

**Diff step** (compare `old` vs `new`):

- **Tracks**:
  - Track added/removed (by Id if present).
  - Track renamed (Id same, name changed).
  - Track type changed (rare; treat as remove+add).
  - Color changed (cosmetic).
- **Devices**:
  - Device added/removed per track.
  - Device name changed (within same tag class, if possible).
- **Samples**:
  - Sample refs added/removed (global set diff).
- **Project-level**:
  - Tempo / time signature changed.
  - Ableton version changed.

### 5.2 Identity heuristics

**Track identity** (in order of reliability):

1. `<AudioTrack Id="...">` / `<MidiTrack Id="...">` (best).
2. Track name + type (fallback for malformed or stripped IDs).
3. If neither is stable, use **position index** within `<Tracks>`.

**Device identity**:

- Use `(device tag, normalized name)` or `(plugin id, normalized name)` when available.
- For plugin devices, prefer `VstPluginInfo/Vst3PluginInfo/AuPluginInfo` names.

**Sample identity**:

- Use `relative_path + file_name` when both present.
- Fallback to `file_name + original_file_size`.

### 5.3 Output tiers

Provide **two diff tiers**:

1. **Core summary** (fast, stable):
   - Tracks added/removed/renamed
   - Devices added/removed
   - Samples added/removed
   - Tempo/time sig changes
2. **Deep musical** (later):
   - Clip-level changes (added clips, changed clip length, warped/unwarped)
   - MIDI note changes
   - Automation changes

### 5.4 Recommended flags / guardrails

- **Strict parse mode** errors on unknown major versions.
- **Best-effort mode**: show whatever we can parse; warn if version unsupported.
- Track parsing can be limited via `max_tracks` to avoid runaway memory.

## 6) Implementation notes for Backtrack

- The parser already scans for `<FileRef>` while skipping unrelated nodes → robust for sample reference extraction even if we don’t fully parse clips.
- The fixture generator shows a realistic minimum schema that’s stable across versions.
- For semantic diff UX, treat *sample changes* and *device changes* as primary user-facing signals.

## 7) Next steps

- Add a tiny XML fixture containing `<FileRef>` to verify sample extraction.
- Expand parsing to detect **clip names** and **clip count** per track (easy first step for “musical” diff).
- Collect a few real `.als` fixtures across Live 10–12 to validate identity heuristics.

---

**Primary references inside repo:**
- `parser-lib/src/xml_parser.rs` — current parsing logic (tracks, devices, FileRef, tempo/time sig).
- `parser-lib/tests/generate_fixtures.rs` — canonical minimal `.als` structure.
- `parser-lib/README.md` — supported versions + parser capabilities.
