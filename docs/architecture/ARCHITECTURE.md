# Backtrack Architecture

## Architecture Goal
Backtrack should be a local-first desktop app with a reliable background engine. The current repo already contains the beginnings of three layers:
- **TypeScript core** for snapshot manifests and diffs.
- **Rust parser/backend** for Ableton-specific parsing and higher-performance local services.
- **Tauri desktop app** for the user-facing product shell.

The product-ready architecture should make those layers explicit and keep responsibilities clean.

## High-Level System

```text
┌──────────────────────────────┐
│ Desktop UI (React + Tauri)   │
│ - onboarding                 │
│ - project list               │
│ - timeline                   │
│ - diff + restore flows       │
└──────────────┬───────────────┘
               │ Tauri commands/events
┌──────────────▼───────────────┐
│ Local Daemon / App Runtime   │
│ - file watching              │
│ - debounce + job queue       │
│ - snapshot orchestration     │
│ - project indexing           │
└───────┬───────────┬──────────┘
        │           │
        │           │
┌───────▼──────┐ ┌──▼────────────────┐
│ Snapshot     │ │ Diff Engine       │
│ Engine       │ │ - manifest diff   │
│ - enumerate  │ │ - metadata diff   │
│ - hash       │ │ - summary builder │
│ - manifest   │ └──┬────────────────┘
└───────┬──────┘    │
        │           │
┌───────▼───────────▼──────────┐
│ Storage Layer                 │
│ - SQLite metadata             │
│ - manifests                   │
│ - content blobs / restores    │
└───────┬───────────────────────┘
        │
┌───────▼───────────────────────┐
│ Ableton Parser (Rust)         │
│ - parse .als                  │
│ - normalize metadata          │
│ - semantic project summaries  │
└───────────────────────────────┘
```

## Module Breakdown

### 1. Snapshot module
**Purpose**
Create deterministic representations of a project state.

**Current code**
- `src/snapshot.ts`
- `src/types.ts`
- `src/cli.ts`

**Responsibilities**
- Resolve tracked project root.
- Walk files recursively.
- Apply ignore rules (`.backtrackignore`, built-in ignores).
- Filter tracked file types.
- Hash files and build `SnapshotManifest`.
- Optionally package/copy files for durable restoration.

**Inputs**
- Project root path
- Ignore patterns
- Include extensions
- Snapshot trigger metadata (`auto`, `manual`, `startup_reconcile`)

**Outputs**
- Snapshot manifest
- Snapshot file entries
- Snapshot stats (duration, errors, bytes)

**Product-ready additions**
- Stream large-file hashing instead of full read into memory.
- Stable snapshot IDs.
- File copy strategy to object store or snapshot bundle.
- Snapshot labels and notes.
- Partial failure reporting.

### 2. Storage module
**Purpose**
Persist project history and make it queryable.

**Current code signal**
- `desktop/src-tauri/src/db.rs` suggests SQLite-backed state already exists or is planned.
- No shared storage contract is documented yet.

**Responsibilities**
- Manage local database schema.
- Persist projects, watched folders, snapshots, parsed metadata, diff caches, restore events.
- Store manifests and optionally blobs on disk.
- Support lookup by project, timestamp, and snapshot pair.

**Recommended storage design**
- **SQLite** for metadata and indexes.
- **Filesystem object store** for manifests and content blobs.

**Suggested tables**
- `watched_folders`
- `projects`
- `snapshots`
- `snapshot_files`
- `project_metadata`
- `restore_events`
- `app_settings`

**Filesystem layout**
```text
~/Library/Application Support/com.backtrack.app/
  db.sqlite
  manifests/
    <snapshot-id>.json
  objects/
    sha256/<hash>
  restores/
    <restore-job-id>/
  logs/
```

**Product-ready additions**
- Schema migrations.
- Data retention / pruning policy.
- Blob deduplication.
- Corruption detection and repair tooling.

### 3. Diff module
**Purpose**
Turn raw snapshot data into useful comparisons.

**Current code**
- `diffSnapshotManifests` in `src/snapshot.ts`

**Responsibilities**
- Compute file-level add/remove/change events.
- Compare parsed Ableton metadata between snapshots.
- Build user-facing summaries.
- Cache diff results for commonly viewed snapshot pairs.

**Diff layers**
1. **File diff**
   - added / removed / changed by path and hash
2. **Metadata diff**
   - track count delta
   - device count delta
   - clip count delta
   - renamed tracks
   - tempo/time signature changes if parseable
3. **Narrative summary**
   - “Added 2 audio files, removed 1 MIDI clip, track count +1”

**Product-ready additions**
- Snapshot pair validation.
- Parser-aware field normalizers so noisy fields do not spam diffs.
- Diff severity ranking for UI.

### 4. UI module
**Purpose**
Provide a calm, musician-friendly front end.

**Current code**
- `desktop/src/App.tsx`
- `desktop/src/components/*`
- `desktop/src/hooks/useTauri.ts`

**Observed structure**
The desktop app already leans toward a three-pane layout:
- left: projects/sidebar
- center: project detail / current changes
- right: timeline

**Responsibilities**
- Onboarding and folder selection.
- Project overview and recent activity.
- Snapshot history browsing.
- Diff presentation.
- Restore flow.
- Settings and notification preferences.

**State model**
- Frontend should be thin.
- Tauri commands fetch authoritative data from the local runtime/storage layer.
- Event bus pushes watcher/snapshot updates to keep UI live.

**Product-ready additions**
- Explicit snapshot detail screen.
- Compare mode between arbitrary revisions.
- Restore wizard with safe target selection.
- Loading/error/empty states polished for non-technical users.

### 5. Daemon module
**Purpose**
Run background orchestration without blocking the UI.

**Current code**
- `desktop/src-tauri/src/file_watcher.rs`
- `desktop/src-tauri/src/commands.rs`
- `desktop/src-tauri/src/state.rs`
- `desktop/src-tauri/src/main.rs`

**Responsibilities**
- Watch folders recursively.
- Debounce rapid save events.
- Queue snapshot jobs.
- Trigger parser runs.
- Write snapshot metadata into storage.
- Emit UI notifications and events.
- Reconcile startup state in case changes were missed while app was closed.

**Runtime design**
- Single process for MVP is fine: Tauri host + background tasks.
- Internally treat it as a daemon service boundary so it can be split later if needed.

**Key subsystems**
- watcher manager
- snapshot job queue
- parser worker
- storage service
- event emitter

**Product-ready additions**
- Backpressure and concurrency limits.
- Job retries with error classification.
- Telemetry/logging around scan duration and failure causes.
- Graceful shutdown handling for in-flight jobs.

## Cross-Module Contracts

### Project
A normalized representation of a tracked Ableton project.

Suggested shape:
```ts
interface ProjectRecord {
  id: string;
  rootPath: string;
  displayName: string;
  lastSnapshotId?: string;
  lastActivityAt?: string;
  status: 'active' | 'missing' | 'error';
}
```

### Snapshot
Recommended extension of current manifest concept:
```ts
interface SnapshotRecord {
  id: string;
  projectId: string;
  kind: 'auto' | 'manual' | 'startup_reconcile';
  createdAt: string;
  note?: string;
  manifestPath: string;
  parserStatus: 'pending' | 'ok' | 'failed';
  totalFiles: number;
  totalSize: number;
}
```

### Parsed Ableton metadata
```ts
interface ProjectMetadata {
  projectName?: string;
  alsPath: string;
  tempo?: number;
  timeSignature?: string;
  trackCount: number;
  deviceCount: number;
  clipCount: number;
  tracks: Array<{
    name: string;
    kind: 'audio' | 'midi' | 'return' | 'master' | 'group' | 'unknown';
    deviceCount: number;
    clipCount: number;
  }>;
}
```

## Data Flow

### Automatic snapshot flow
1. User adds watched folder in UI.
2. Daemon indexes projects within folder.
3. Watcher sees `.als` or tracked asset changes.
4. Debounce waits for save burst to settle.
5. Snapshot module enumerates files + hashes content.
6. Storage persists snapshot record and manifest.
7. Parser extracts `.als` metadata.
8. Diff module compares against previous snapshot.
9. Daemon emits event to UI.
10. UI updates timeline/recent changes and shows optional notification.

### Restore flow
1. User selects snapshot in UI.
2. UI requests restore preview.
3. Storage resolves files/blobs for snapshot.
4. Restore service writes to recovery folder.
5. Event logged in `restore_events`.
6. UI confirms completion and offers “Open in Finder”.

## Repository Mapping

### Existing repo zones
- `src/` → reusable TS snapshot/diff core
- `parser-lib/` → Rust Ableton parser
- `backend/` → future shared Rust service library
- `desktop/` → Tauri product shell

### Recommended near-term structure
```text
backtrack/
  src/                    # TS snapshot + diff core (or migrate into packages/core)
  parser-lib/             # Rust Ableton parser
  backend/                # Rust domain/service crate for storage + orchestration
  desktop/                # Tauri app
  PRODUCT_REQUIREMENTS.md
  ARCHITECTURE.md
  TODO.md
```

## Technical Decisions for MVP
- **Desktop shell:** Tauri
- **Frontend:** React + TypeScript
- **Background runtime:** Rust inside Tauri app process
- **Snapshot/diff core:** keep TS implementation initially; consider migrating hot paths to Rust later
- **Parser:** Rust crate (`parser-lib`)
- **Metadata DB:** SQLite
- **Blob store:** local filesystem, content-addressed where practical

## Key Risks and Mitigations
- **Large projects create expensive snapshots**
  - Mitigate with hashing streams, dedupe, background queue, and incremental optimization.
- **Parser instability across Ableton versions**
  - Treat parser output as optional enrichment; never block file-level history.
- **UI gets coupled to internal state**
  - Keep Tauri commands/events as explicit API boundary.
- **Restore could overwrite live work**
  - Default to restoring into new folders for MVP.

## Suggested Milestones
1. **Core reliability**: deterministic snapshots, storage schema, background queue.
2. **Usable desktop MVP**: project list, timeline, snapshot creation, recent changes.
3. **Meaningful compare/restore**: parsed metadata diff + safe recovery flow.
4. **Polish**: performance tuning, onboarding, notifications, packaging.
