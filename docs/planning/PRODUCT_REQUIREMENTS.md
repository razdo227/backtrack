# Backtrack Product Requirements

## Product Summary
Backtrack is local-first version control for Ableton Live projects. It watches project folders, creates deterministic snapshots of the session plus referenced assets, shows meaningful diffs, and lets musicians recover ideas without thinking like software engineers.

The product should feel like **Git for beats, not Git for programmers**.

## Problem
Ableton projects evolve quickly and destructively:
- Producers overwrite arrangements, sound design, and mix decisions in place.
- Autosave and duplicated project folders are messy, hard to search, and easy to lose.
- General version control tools do not understand `.als` projects, audio assets, or music workflow.
- Reverting is usually manual and risky.

## Vision
Give creators a calm background tool that:
1. Automatically captures project history.
2. Explains what changed in human terms.
3. Lets users compare, restore, and branch ideas safely.
4. Runs locally with minimal setup and no cloud dependency for MVP.

## Target Users

### Primary user
**Solo Ableton producer**
- Works on multiple songs in parallel.
- Saves often but versions chaotically.
- Wants safety without added friction.
- Cares more about recovering ideas than about engineering purity.

### Secondary users
- Mix engineers iterating on multiple revisions.
- Songwriters collaborating locally before formal release handoff.
- Creative technologists managing sample-heavy sessions.

## Product Principles
- **Automatic first**: users should not need to remember to version.
- **Local-first**: core functionality works offline on one machine.
- **Musician-readable diffs**: show tracks/devices/clips/files, not raw XML dumps.
- **Fast enough to disappear**: background work should not interrupt production.
- **Safe by default**: never mutate project files without explicit user action.

## MVP Scope
The MVP is a desktop menubar app plus local engine that can:
- Watch user-selected folders for Ableton projects.
- Detect stable save events and create snapshots automatically.
- Store snapshots and metadata locally.
- Show a timeline of revisions per project.
- Compute diffs between snapshots for files and parsed Ableton metadata.
- Restore individual files or open a snapshot folder for recovery.
- Allow manual snapshot creation with a user note.

Out of scope for MVP:
- Real-time multiplayer collaboration.
- Cloud sync / team accounts.
- Full Git interoperability.
- Perfect semantic understanding of every Ableton device parameter.
- Audio rendering / waveform diffing.

## Core User Stories

### 1. Onboarding and setup
**As a producer**, I want to add one or more project folders so Backtrack can start tracking them in the background.

**Acceptance criteria**
- User can add/remove watched folders from desktop UI.
- App scans subfolders for likely Ableton projects (`.als` present).
- App clearly shows which projects are being tracked.
- Tracking persists across app restarts.

### 2. Automatic snapshot creation
**As a producer**, I want Backtrack to create snapshots automatically after I save so I don’t have to remember versioning.

**Acceptance criteria**
- File changes trigger debounce logic to avoid duplicate snapshots during save bursts.
- Snapshots are only created when project content actually changed.
- Snapshot creation works for `.als` plus referenced project assets included in tracked scope.
- User receives subtle confirmation in UI/system notification.

### 3. Manual checkpointing
**As a producer**, I want to create a named checkpoint before trying a risky idea.

**Acceptance criteria**
- User can click “Create Snapshot” from UI.
- User can optionally add a short label/note.
- Manual snapshots are visually distinct from automatic ones.

### 4. Timeline/history browsing
**As a producer**, I want to browse previous versions of a song so I can understand how it evolved.

**Acceptance criteria**
- Timeline lists snapshots in reverse chronological order.
- Each item shows timestamp, snapshot type, project summary, and optional note.
- Selecting a snapshot shows metadata summary and changed files.

### 5. Meaningful diff view
**As a producer**, I want to compare two versions and see what changed in plain language.

**Acceptance criteria**
- Diff view shows file-level changes: added, removed, modified.
- For `.als`, diff view shows parsed metadata deltas where available:
  - track count
  - device count
  - clip count
  - tempo/time signature if parseable
  - renamed tracks
- If semantic parse data is unavailable, file hash diff still works.

### 6. Recovery / restore
**As a producer**, I want to recover an earlier state without risking the current one.

**Acceptance criteria**
- User can restore a snapshot to a new recovery folder.
- User can restore specific files from a snapshot.
- App warns before writing files into an existing project directory.
- Restore operation is logged in snapshot/event history.

### 7. Project overview
**As a producer**, I want to quickly see which projects changed recently.

**Acceptance criteria**
- Main view shows tracked projects and latest activity.
- Recent changes feed aggregates snapshot events across projects.
- Projects can be sorted by recent activity.

### 8. Reliability and trust
**As a producer**, I want Backtrack to be dependable so I can trust it with real sessions.

**Acceptance criteria**
- Snapshot manifests are deterministic for unchanged content.
- Corrupt or unreadable files fail gracefully and are surfaced in logs/UI.
- App startup reloads history from disk/database.
- Large folders do not freeze the UI.

## Functional Requirements

### Snapshot engine
- Generate deterministic manifests for tracked files.
- Include file path, size, hash, mtime, and snapshot timestamp.
- Respect `.backtrackignore` patterns.
- Support configurable include extensions.
- Support manual and automatic snapshot triggers.

### Storage
- Persist snapshot metadata in SQLite for queryable history.
- Persist manifest JSON and copied/restorable files in local object storage.
- Deduplicate identical file blobs by content hash where practical.
- Keep project-to-snapshot relationships indexed.

### Ableton parsing
- Parse `.als` files into normalized project metadata using Rust parser.
- Extract minimal stable fields for MVP summaries and diffs.
- Store parser output alongside snapshot metadata.
- Degrade cleanly when parse fails or file format edge cases appear.

### Diff engine
- Compare manifests by path/hash/size.
- Compare parsed Ableton metadata between snapshots.
- Produce structured diff payloads consumable by CLI and desktop UI.
- Support diffing arbitrary snapshot pairs in the same project.

### Desktop UI
- Menubar app with dashboard window.
- Onboarding for watched folders.
- Project list + current project detail + timeline.
- Snapshot detail view and diff view.
- Settings for watch paths, notifications, auto-snapshot behavior, storage location.

### Background daemon behavior
- File watching with debounce.
- Safe work queue so indexing/snapshotting does not overlap dangerously.
- Background scans at startup to reconcile missed changes.
- Emit events to UI for status, progress, and failures.

## Non-Functional Requirements
- macOS-first for MVP; architecture should not block Windows support later.
- Typical snapshot creation should complete in seconds for medium-size projects.
- UI must remain responsive during scans/snapshots.
- No internet required for core workflow.
- All snapshot data is stored locally in user-accessible directories.

## UX Requirements
- Default language should be musician-friendly, not developer-heavy.
- Avoid terms like “commit”, “branch”, and “rebase” in MVP UI unless clearly translated.
- Prefer “Snapshot”, “Checkpoint”, “History”, “Restore”, “Compare”.
- Notifications should be low-noise and easy to disable.

## Success Metrics for MVP
- User can install, add folders, and see first tracked project within 5 minutes.
- Automatic snapshots succeed for >95% of normal save events in test corpus.
- Diff view is useful enough that users can identify the right recovery point without opening every snapshot manually.
- Restore flow succeeds without overwriting current work by accident.

## Risks
- `.als` parsing may be incomplete across Ableton versions.
- Asset reference resolution may be tricky for external sample libraries.
- Large project folders could cause heavy I/O if snapshotting copies entire trees naïvely.
- Too much notification noise will make users disable the app.

## Open Questions
- Should snapshots copy full project state, or use content-addressed blobs plus manifests from day one?
- What is the right default snapshot cadence besides save-triggered events?
- Should “restore” write into original project folder at all, or only recover to new folders in MVP?
- Which Ableton metadata fields are stable enough to show without confusing users?
