# Backtrack QA Strategy

## Purpose

Backtrack sits on a tricky boundary: normal app code on one side, messy real-world Ableton projects on the other. QA should protect the core promise of the product:

1. Backtrack finds the right project files.
2. It parses Ableton sets safely and consistently.
3. It reports meaningful changes without corrupting project data.
4. Desktop workflows behave predictably across real folders, large projects, and weird edge cases.

This plan is designed for the current repo shape:

- **TypeScript core**: snapshot + diff logic in `src/`
- **Rust parser**: `parser-lib/`
- **Tauri desktop app**: `desktop/src/` + `desktop/src-tauri/`

---

## Quality goals

### Must not regress
- Snapshot manifests stay deterministic for the same project contents.
- `.als` parsing remains stable for supported Live versions.
- Ignore rules never accidentally pull in junk folders or omit critical project files.
- Desktop commands return actionable errors instead of crashing or hanging.
- File watching does not duplicate events excessively or lose track of watched folders.

### Product-level confidence signals
- Real Ableton fixture projects parse end-to-end.
- A realistic project rename/add/remove/change sequence produces the expected diff.
- New releases are tested against at least one small and one medium fixture project.
- Packaging/build verification happens before shipping desktop releases.

---

## Recommended test pyramid

Backtrack should lean heavily on **fast automated tests at the bottom**, with a small but high-value integration/E2E layer on top.

### 1) Unit tests — ~65%
Fast, deterministic, run on every PR.

**TypeScript unit tests**
- `src/snapshot.ts`
  - ignore matching
  - extension filtering
  - manifest sorting/determinism
  - hashing behavior
  - diff behavior for add/remove/change/no-change
- CLI argument handling in `src/cli.ts`
  - missing args
  - invalid paths
  - snapshot to stdout vs file
  - diff output formatting

**Rust unit tests**
- `parser-lib/src/decompressor.rs`
  - valid gzip
  - invalid gzip
  - empty file
- `parser-lib/src/xml_parser.rs`
  - track extraction
  - device extraction
  - missing optional fields
  - unsupported/unknown versions in strict vs non-strict mode
- `parser-lib/src/diff/*`
  - track add/remove/rename/change cases
  - device diff formatting
  - stable ordering in diff output

**Desktop frontend unit/component tests**
Add a lightweight test stack (Vitest + React Testing Library) for:
- `App.tsx`
  - onboarding visibility rules
  - selected project fallback behavior
  - timeline width persistence/clamping
- key components
  - `Onboarding`
  - `WatchedFolders`
  - `RecentChanges`
  - `SettingsModal`
- `useTauri` hook behavior with mocked invoke/event APIs

### 2) Integration tests — ~25%
Covers boundaries between modules and realistic file IO.

**TypeScript integration tests**
- Create temporary Ableton-like project trees and assert full manifest output.
- Snapshot/diff round-trips using fixture directories.
- CLI smoke tests via spawned process (`node dist/cli.js ...`).

**Rust parser integration tests**
Expand `parser-lib/tests/integration_test.rs` into fixture-driven coverage for:
- simple audio + MIDI sets
- return tracks / master track presence
- grouped tracks
- plugin/device name extraction
- malformed XML / truncated gzip / corrupted files
- unsupported version handling

**Tauri backend integration tests**
Add Rust tests around `desktop/src-tauri/src/commands.rs` and helper modules for:
- `scan_for_projects`
- `get_projects_overview`
- `initialize_projects`
- version extraction from filenames
- metadata fallback behavior when parsing fails

These should use temp directories and fixture projects rather than a live Ableton install.

### 3) End-to-end / workflow tests — ~10%
Small in number, high in value.

Prioritize only the critical flows:
- Add watched folder
- Scan for projects
- Initialize selected projects
- Parse a real `.als` file
- Show recent changes after fixture file mutation
- Re-open app and confirm watched folders persist

Recommended tooling:
- **Playwright** for desktop web/UI surface where feasible
- **Tauri integration/E2E** only for a minimal smoke suite, since these tests are slower and more brittle

---

## Automated tests to add

Below is the practical test backlog in priority order.

## Phase 1 — high ROI, should happen first

### TypeScript core
1. **Deterministic manifest snapshots**
   - same files, different creation order => identical manifest file ordering
2. **Ignore rule edge cases**
   - nested folders
   - trailing slash entries
   - Windows-style paths in `.backtrackignore`
   - hidden files vs hidden folders
3. **Binary file hashing tests**
   - verify non-text media files are hashed correctly
4. **No-op diff tests**
   - changed mtime only, same content => should not appear as changed if hash+size unchanged
5. **CLI smoke coverage**
   - `snapshot` command writes JSON
   - `diff` command prints expected sections

### Rust parser
6. **Fixture matrix for Live versions**
   - Live 9/10/11/12 sample fixtures where available
7. **Malformed input tests**
   - invalid gzip
   - non-gzip file with `.als` extension
   - truncated archive
   - invalid XML
8. **Track/device parsing coverage**
   - audio, MIDI, return, master, group tracks
   - nested devices / plugin naming cases
9. **Strict mode tests**
   - unknown major version rejected in strict mode and tolerated in non-strict mode

### Desktop/Tauri
10. **Command tests for project scanning**
    - immediate child directories only
    - ignores hidden/backup folders
    - detects `.als` at nested depth
11. **Project overview sorting/mtime tests**
    - most recent `.als` takes priority over directory mtime
12. **Version extraction tests**
    - `Project v1.als`, `Project_v2.1.als`, `Project version 3.als`
13. **Settings persistence tests**
    - save/load watched folders
    - nonexistent saved path is skipped safely

## Phase 2 — after the basics are green

14. **File watcher debounce tests**
    - burst changes coalesce into sensible recent changes
15. **Database/history tests**
    - recent change retrieval limit/order
16. **Frontend component tests**
    - onboarding completion persistence
    - timeline width clamp + localStorage behavior
17. **Desktop smoke E2E**
    - first-run onboarding
    - add folder
    - scan projects
    - reopen app with persisted state

## Phase 3 — release hardening

18. **Large-project performance regression tests**
    - many samples
    - large fixture tree
19. **Cross-platform path tests**
    - Windows separators
    - case sensitivity assumptions
20. **Golden output tests**
    - parser JSON snapshots
    - diff formatter output snapshots
21. **Packaging smoke tests**
    - desktop build artifacts launch and basic commands respond

---

## Fixture strategy

Fixtures matter more here than in a generic web app. Backtrack’s real correctness depends on weird Ableton project shapes, compressed `.als` files, naming patterns, and folder layout.

## Fixture design principles

- **Keep fixtures minimal but realistic**.
- **Prefer non-sensitive synthetic projects** over real artist sessions.
- **Separate parser fixtures from full project fixtures**.
- **Version fixtures deliberately** so expected outputs are stable.
- **Document each fixture’s purpose** so failures are understandable.

## Proposed fixture layout

```text
backtrack/
  test/
    fixtures/
      projects/
        minimal-audio-project/
          Song.als
          Samples/Kick.wav
        mixed-media-project/
          Song.als
          Samples/Kick.wav
          Samples/Snare.aif
          Freeze/Track 1.wav
        ignored-content-project/
          .backtrackignore
          Song.als
          Exports/mix.wav
          Stems/final/vocals.wav
      manifests/
        minimal-audio-project.snapshot.json
        mixed-media-project.snapshot.json
  parser-lib/
    tests/
      fixtures/
        live9-simple.als
        live10-groups.als
        live11-devices.als
        live12-edgecases.als
        invalid-gzip.als
        truncated.als
```

## Fixture categories

### 1) Parser fixtures (`parser-lib/tests/fixtures/`)
Use for Rust parser correctness only.

Include:
- tiny gzipped `.als` files generated from synthetic XML
- one fixture per parser behavior
- intentionally broken fixtures for error handling

Suggested set:
- `live11-simple.als`
- `live11-return-master.als`
- `live11-groups.als`
- `live12-plugin-names.als`
- `unsupported-major.als`
- `invalid-gzip.als`
- `truncated.als`
- `invalid-xml.als`

### 2) Full project fixtures (`test/fixtures/projects/`)
Use for snapshot/diff/desktop integration.

Each project fixture should include:
- at least one `.als`
- a few representative sample files
- optional ignored folders (`Exports`, `Stems`, `.git`, `backup`)
- clear expected behavior notes

Suggested set:
- **minimal-audio-project** — smallest valid happy path
- **multi-set-project** — multiple `.als` versions in one project folder
- **ignored-content-project** — exercises `.backtrackignore`
- **nested-samples-project** — deep folders and mixed media
- **project-with-backtrack-dir** — ensures internal metadata is ignored or handled correctly

### 3) Mutation fixtures for diff tests
Instead of storing dozens of nearly identical full projects, keep one base fixture and generate variants in test setup:
- add sample
- remove sample
- modify `.als`
- rename versioned file

This keeps the repo small and the assertions clearer.

## Fixture generation rules

- Add a small script for generating parser fixtures from XML source where possible.
- Commit the generated `.als` artifacts used by tests.
- Avoid huge binary sample files; tiny placeholder audio files are enough for manifest/hash coverage.
- If a real-world bug appears, add a **minimal reproducer fixture** named after the bug class.

## Fixture metadata

Add a short `README.md` under fixture directories describing:
- what each fixture represents
- what behavior it protects
- whether it is synthetic or derived from a sanitized real project

---

## CI test matrix

Recommended CI pipeline:

### Fast PR pipeline
Run on every pull request:
- `npm test`
- `npm run build`
- `cargo test -p backtrack-parser`
- desktop frontend typecheck/build
- tauri backend test target (if present)

### Nightly / pre-release pipeline
Run on merge to main or before shipping:
- full parser fixture suite
- desktop integration tests
- watcher/debounce tests
- package/build smoke tests for supported platforms

### Nice-to-have gates
- fail on uncovered snapshot/diff parser regressions
- upload test artifacts for failed desktop integration runs
- preserve golden diff output on snapshot mismatch for easier review

---

## Manual QA checklists

Manual QA should be short and surgical. Don’t substitute manual clicking for missing automated coverage.

## Per-feature QA checklist

For any change touching snapshot/parser/desktop workflows:
- Can I run the changed flow on a minimal fixture project?
- Does it still work on a project with ignored folders?
- Are error messages understandable for bad paths or bad `.als` files?
- Does anything break after restarting the desktop app?

## Release checklist

### Every release
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] `cargo test -p backtrack-parser` passes
- [ ] desktop frontend build passes
- [ ] any Tauri/backend tests pass
- [ ] no uncommitted fixture changes unless intentional
- [ ] changelog/release notes mention any parser compatibility changes

### Snapshot + diff validation
- [ ] Run snapshot against `minimal-audio-project`
- [ ] Run snapshot against `ignored-content-project`
- [ ] Diff two project states and confirm added/removed/changed output is sane
- [ ] Confirm deterministic output when rerunning snapshot without content changes

### Parser validation
- [ ] Parse at least one known-good Live 11 or 12 fixture
- [ ] Parse one malformed fixture and confirm graceful failure
- [ ] Verify track names, types, and device names still appear as expected
- [ ] Verify unsupported version behavior matches product expectations

### Desktop validation
- [ ] Fresh install / clean state launches successfully
- [ ] Add watched folder works
- [ ] Scan for projects finds expected fixture projects only
- [ ] Initialize selected projects behaves correctly for new + already-initialized projects
- [ ] Recent changes view loads without crashing
- [ ] Restart app and confirm watched folders/settings persist

### Pre-public release sanity
- [ ] Test on at least one real non-sensitive Ableton project copy
- [ ] Confirm no secrets, private session data, or large accidental binaries were added to repo
- [ ] Confirm packaging artifacts launch on target OS(es)

---

## Bug handling policy

Every production bug should try to produce one of the following:
- a new unit test,
- a new fixture,
- or a new integration test.

Preferred order:
1. Reproduce with minimal fixture.
2. Add failing automated test.
3. Fix.
4. Keep the reproducer fixture if it protects a realistic class of issue.

---

## Suggested implementation order

If the team only has time for a few QA improvements, do these first:

1. Expand Rust parser fixture coverage.
2. Add TypeScript CLI + manifest determinism tests.
3. Add Tauri command tests for project scanning and settings persistence.
4. Introduce frontend component tests for onboarding/state persistence.
5. Add one desktop smoke E2E flow.

That order gives the best confidence per hour because it protects the core logic before chasing flaky UI automation.

---

## Definition of done for QA on Backtrack

A feature is QA-complete when:
- core behavior is covered by unit or integration tests,
- at least one realistic fixture exercises the change,
- error handling is verified,
- and the change is represented in the release checklist if it affects shipping behavior.

Backtrack does not need a massive QA bureaucracy. It needs a disciplined set of fast tests, good Ableton fixtures, and a short release ritual that catches regressions before users do.
