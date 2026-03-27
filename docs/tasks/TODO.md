# Backtrack MVP TODO

Priority scale:
- **P0** = blocking for a believable MVP
- **P1** = important for usability and trust
- **P2** = polish / next-up after MVP foundation

## P0 — Core product path

### 1. Define storage schema and local data layout
- [ ] Create SQLite schema for watched folders, projects, snapshots, parsed metadata, and restore events.
- [ ] Choose and document app data directory layout for DB, manifests, blobs, and logs.
- [ ] Add schema migration mechanism.
- [ ] Add typed data access layer in Rust (`desktop/src-tauri/src/db.rs` or shared `backend/`).

**Why first:** snapshot history is not a product until it persists reliably.

### 2. Promote snapshot manifests from utility to product feature
- [ ] Extend snapshot model with snapshot ID, project ID, kind (`auto` / `manual`), optional note, and error state.
- [ ] Refactor hashing to stream large files instead of reading everything into memory.
- [ ] Add snapshot creation timing + stats.
- [ ] Persist manifests to disk automatically.
- [ ] Add tests for deterministic outputs and ignore behavior.

**Done when:** a saved project produces a persisted snapshot record and manifest every time content changes.

### 3. Build daemon snapshot pipeline
- [ ] Audit existing watcher/debounce behavior in `desktop/src-tauri/src/file_watcher.rs`.
- [ ] Add a serialized job queue for snapshot work.
- [ ] Ensure duplicate save bursts collapse into one snapshot.
- [ ] Add startup reconciliation to detect changes missed while app was closed.
- [ ] Emit structured events to frontend for `snapshot_started`, `snapshot_completed`, `snapshot_failed`.

**Done when:** watched projects snapshot automatically and predictably without UI freezes.

### 4. Connect parser output to snapshot records
- [ ] Define normalized Ableton metadata shape shared between Rust and TS.
- [ ] Parse `.als` as part of snapshot completion flow.
- [ ] Store parser output per snapshot.
- [ ] Gracefully handle parser failures without losing file-level snapshot history.
- [ ] Add fixture-based parser tests for a few representative projects.

**Done when:** each snapshot has either parsed metadata or an explicit parser failure state.

### 5. Make the desktop timeline real
- [ ] Replace mock/current placeholder data in desktop UI with snapshot history from storage.
- [ ] Show projects sorted by latest activity.
- [ ] Show timeline entries with timestamp, type, and short summary.
- [ ] Add empty/loading/error states.
- [ ] Keep onboarding flow intact when no tracked projects exist.

**Done when:** a user can add a folder, save in Ableton, and immediately see new history items appear.

## P1 — Must-have usability

### 6. Add compare view
- [ ] Create backend command to diff two snapshot IDs.
- [ ] Merge file diff + parsed metadata diff into one response payload.
- [ ] Build UI compare panel for selected snapshots.
- [ ] Add human-readable summary strings (ex: `+1 track`, `2 files changed`).
- [ ] Add tests for diff edge cases.

### 7. Add manual snapshot / checkpoint flow
- [ ] Add “Create Snapshot” action in UI.
- [ ] Support optional note/label.
- [ ] Surface manual snapshots distinctly in timeline.
- [ ] Add backend command and persistence.

### 8. Implement safe restore flow
- [ ] Decide MVP restore policy: restore to new folder by default.
- [ ] Build restore preview command listing files to be written.
- [ ] Implement restore job in backend/storage layer.
- [ ] Add confirmation UX and completion feedback.
- [ ] Log restore events.

### 9. Improve project discovery
- [ ] Formalize rules for identifying an Ableton project root.
- [ ] Scan watched folders for `.als` files and group them into projects.
- [ ] Handle renamed/moved/missing projects gracefully.
- [ ] Add rescan command.

### 10. Reliability + observability
- [ ] Add structured logging around watcher events, snapshot duration, parser failures, and restore jobs.
- [ ] Add a lightweight debug/status screen in app settings.
- [ ] Create a small corpus of test Ableton projects for regression testing.
- [ ] Define failure messages that are musician-readable.

## P2 — Strong polish / post-foundation

### 11. Performance improvements
- [ ] Evaluate content-addressed blob store for deduplicated asset storage.
- [ ] Cache common diffs.
- [ ] Add lazy loading/pagination for long timelines.
- [ ] Profile large project snapshot times.

### 12. UX polish
- [ ] Refine terminology to prefer Snapshot / Compare / Restore over dev-heavy words.
- [ ] Add notification preferences.
- [ ] Add first-run explanation of what is and isn’t tracked.
- [ ] Add “Open project folder” and “Reveal restored files” shortcuts.

### 13. Packaging and release readiness
- [ ] Document install/run flow for macOS testers.
- [ ] Add app versioning + release checklist.
- [ ] Define crash-report/log collection process for internal testing.
- [ ] Prepare sample demo project for onboarding/testing.

## Suggested first engineering sequence
1. Storage schema + migrations
2. Snapshot record model upgrade
3. Background job queue
4. Parser integration per snapshot
5. Real timeline data in UI
6. Compare view
7. Manual snapshots
8. Restore flow

## Candidate issues / tickets

### Ticket 1 — Create snapshot persistence layer
**Owner:** backend
**Scope:** SQLite schema, manifest write path, create/list snapshot APIs

### Ticket 2 — Add daemon snapshot queue
**Owner:** backend/runtime
**Scope:** watcher event intake, debounce, serialized jobs, UI events

### Ticket 3 — Normalize parser metadata contract
**Owner:** parser + backend
**Scope:** snapshot-linked metadata schema, parser status handling, fixtures

### Ticket 4 — Replace mock timeline with real snapshot history
**Owner:** desktop
**Scope:** Tauri commands, hooks, timeline UI, loading/empty states

### Ticket 5 — Build compare API and compare UI
**Owner:** backend + desktop
**Scope:** snapshot pair diff endpoint, human-readable summary rendering
