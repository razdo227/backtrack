// Tauri types matching Rust structs

export interface AbletonProject {
  version: AbletonVersion;
  tracks: Track[];
  master_track: Track | null;
}

export interface AbletonVersion {
  major: number;
  minor: string;
  creator: string | null;
}

export interface Track {
  id: string | null;
  track_type: TrackType;
  name: string;
  color: number | null;
  devices: Device[];
}

export interface Device {
  name: string;
  device_type: DeviceType;
}

export type TrackType = 'audio' | 'midi' | 'return' | 'master' | 'group' | 'unknown';

export type DeviceType =
  | 'native_instrument'
  | 'native_effect'
  | 'rack'
  | 'vst_plugin'
  | 'vst3_plugin'
  | 'audio_unit_plugin'
  | 'unknown';

export interface ChangeEvent {
  file_path: string;
  file_name: string;
  timestamp: string;
  summary: string;
  track_count: number;
  device_count: number;
  file_hash?: string;
  diff?: ProjectDiff;
  diff_summary?: string;
}

export interface ProjectDiff {
  tracks_added: Track[];
  tracks_removed: Track[];
  tracks_modified: TrackModification[];
  master_changes: MasterChange[];
}

export interface TrackModification {
  track_id: string;
  old_name: string;
  new_name: string;
  name_changed: boolean;
  color_changed?: [number | null, number | null];
  devices_added: Device[];
  devices_removed: Device[];
}

export type MasterChange =
  | { DeviceAdded: Device }
  | { DeviceRemoved: Device };

export interface FileChangedEvent {
  path: string;
  status: string;
  timestamp: string;
}

export interface FileParsedEvent {
  path: string;
  project: AbletonProject;
  change: ChangeEvent;
  timestamp: string;
}

export interface ParseErrorEvent {
  path: string;
  error: string;
  timestamp: string;
}

export interface ProjectOverview {
  path: string;
  name: string;
  dir_modified_ms: number | null;
  has_backtrack_file: boolean;
}
