# Snapshot Storage + Restore QA Test Plan

## Purpose
Validate that snapshot storage metadata and restore/reload workflows are reliable, deterministic, and recoverable after app restarts.

## Scope
Covers the new snapshot storage plumbing and restore/reload behavior in the desktop backend, including:
- Project initialization metadata (`.backtrack/project.bt`)
- Local history persistence (`.backtrack/db.sqlite`)
- App restart restore behavior for stored metadata

## Automated smoke tests (Rust)
Implemented in `desktop/src-tauri/src/backtrack_init.rs` and `desktop/src-tauri/src/db.rs`.

- **Init file round-trip**
  - Create `.backtrack/project.bt`
  - Read it back and validate timestamps
  - Ensure subsequent init does not rewrite

- **Corrupt init file recovery**
  - Write invalid data to `.backtrack/project.bt`
  - Ensure `ensure_init_file` rewrites and can read again

- **DB storage/restore**
  - Log a `ChangeEvent`
  - Verify `db.sqlite` is created
  - Fetch history and confirm the event round-trips

Run via:
```bash
cargo test -p backtrack-desktop
```

## Manual QA checklist
1. **Initialize project storage**
   - Add a watched folder with a sample project
   - Confirm `.backtrack/` folder is created in the project root
   - Confirm `project.bt` and `db.sqlite` exist

2. **Persistence after restart**
   - Close and reopen the app
   - Confirm watched folders are restored
   - Confirm recent changes can be loaded (if any)

3. **Corrupt init file recovery (manual sanity)**
   - Replace `.backtrack/project.bt` with random text
   - Relaunch app and re-initialize project
   - Confirm new valid `project.bt` is created

4. **Basic snapshot history flow**
   - Modify an `.als` file in a watched project
   - Verify a new entry appears in Recent Changes
   - Restart app and confirm the entry persists

## Notes
- These tests focus on storage/restore stability rather than full UI flows.
- Expand to cover full snapshot manifests and restore workflows when snapshot storage moves beyond the current metadata + history layer.
