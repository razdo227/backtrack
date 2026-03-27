# Backtrack Product Plan

## Product Vision

Backtrack is version control for Ableton Live projects.

Its job is not to replace Git for engineers. Its job is to give music producers a way to understand, trust, and roll back creative changes inside messy, fast-moving Ableton sessions without breaking flow.

Backtrack should answer four questions better than any current workflow:

1. What changed in this project since the last save or session?
2. When did the project sound/structure better, and how do I get back there?
3. Which files belong to this song and which are missing, duplicated, or drifting?
4. How can collaborators safely work on a project without creating folder chaos?

### Product thesis

Music production has a versioning problem, but producers do not want a developer tool. They want automatic history, meaningful diffs, session recovery, and confidence. Backtrack wins if it feels like native producer infrastructure: always on, low friction, clear, and impossible to screw up.

### Positioning

- **Category:** Ableton project history + version intelligence
- **Primary wedge:** automatic snapshots and meaningful change tracking for `.als`-based projects
- **Long-term moat:** deep project understanding, audio-aware diffs, recovery workflows, and collaboration primitives tailored to DAW users

---

## Target Users and Personas

### 1. Solo Producer Sam

**Profile:** Independent producer working on dozens of demos and client records.

**Pain points:**
- Saves over good ideas by accident
- Creates chaotic folders like `song_v12_FINAL_REAL` 
- Cannot remember when a specific arrangement or sound design decision happened
- Afraid to experiment because rollback is painful

**What Sam needs from Backtrack:**
- Automatic snapshots
- Easy compare/restore points
- Lightweight notifications of meaningful changes
- Zero setup after choosing a project folder

### 2. Professional Writer/Artist Ava

**Profile:** Fast-moving artist/producer with label deadlines, multiple collaborators, and many project versions.

**Pain points:**
- Sessions fork across laptops, drives, and collaborators
- Missing samples or stale exports create expensive confusion
- Version naming conventions are inconsistent across teams

**What Ava needs:**
- Reliable project history
- Shareable timeline of session changes
- Clear view of project assets and missing dependencies
- A trustworthy “latest safe version” concept

### 3. Mix Engineer Marco

**Profile:** Opens client Ableton projects for cleanup, editing, export prep, or stem revision work.

**Pain points:**
- Receives broken or incomplete projects
- Needs to know what changed between revisions
- Wants auditability before delivering stems or mixes

**What Marco needs:**
- Diffing between revisions
- Asset integrity checks
- Restore/branch points before destructive edits
- Export notes and revision labels

### 4. Student Creator Nia

**Profile:** Learning Ableton, iterating quickly, often on one laptop and external drive.

**Pain points:**
- Disorganized file structure
- Little understanding of project dependencies
- Frequently loses work or overwrites experiments

**What Nia needs:**
- A simple “history for my project” mental model
- Friendly UX and safe defaults
- Recovery from mistakes without technical knowledge

---

## Problem Statement

Ableton Live projects combine a session file with a changing graph of samples, presets, devices, and exported media. Existing workflows rely on manual save-as duplication, Finder folder discipline, cloud sync, or Git-based hacks that do not match how producers work.

This causes:
- accidental overwrites
- invisible creative regressions
- missing asset failures
- collaboration confusion
- fear of experimentation

Backtrack solves this by turning project state into trackable snapshots, meaningful diffs, and eventually restorable history.

---

## Product Principles

1. **Automatic by default** — users should not have to remember to version their work.
2. **Musician-first UX** — no Git jargon in core workflows.
3. **Trustworthy history** — every snapshot must be deterministic and explainable.
4. **Fast and local-first** — core functionality should work without cloud dependence.
5. **Meaningful diffs over raw file diffs** — show project-level changes, not just byte changes.
6. **Low interruption** — Backtrack should support flow, not demand attention.

---

## Current Product/Foundation State

Backtrack already has the start of a credible technical core:

- deterministic snapshot manifest generation
- file hashing for project assets
- diffing of snapshot manifests into added/removed/changed
- `.backtrackignore` support
- basic CLI for snapshot/diff workflows
- early desktop/Tauri scaffold for watched folders and file notifications
- parser-oriented direction for `.als` metadata extraction

This means the product should not start with “build everything from zero.” The right move is to productize the snapshot engine and connect it to an always-on desktop workflow.

---

## MVP Scope

### MVP goal

Deliver the first useful version for solo producers on macOS that automatically watches Ableton project folders, creates local history points, and lets users inspect what changed between snapshots.

### MVP user promise

“Pick your Ableton projects folder, and Backtrack will quietly keep a usable history of your sessions so you can see what changed and recover confidence.”

### In scope

1. **Folder watch setup**
   - Add/remove watched folders
   - Persist settings locally
   - Filter for Ableton project structures and key file types

2. **Automatic snapshot creation**
   - Trigger on `.als` save/change events with debounce
   - Hash relevant project files
   - Store snapshots in structured local storage

3. **Snapshot timeline**
   - List recent project snapshots
   - Show timestamp, project name, total files, size, and summary metadata

4. **Basic diff viewer**
   - Added/removed/changed files
   - Surface `.als` change summary when available
   - Highlight likely-important asset changes

5. **Project summary metadata**
   - Parse enough `.als` data to show useful labels like project name, track count, devices count, tempo when available

6. **Recovery primitives**
   - Open snapshot folder location
   - Export snapshot manifest
   - Duplicate a snapshot into a recoverable working copy

7. **Local trust features**
   - Clear snapshot status
   - Error logs
   - Ignore rules support

### Explicitly out of scope for MVP

- real-time multi-user collaboration
- cloud sync as a dependency
- full project restore with binary patching
- audio preview diffing
- deep arrangement-level semantic diffs
- Windows/Linux parity
- in-app billing and team administration

---

## v1 Feature Set

v1 should turn MVP utility into a real product people can recommend.

### 1. Better project intelligence
- richer `.als` parsing
- semantic change summaries:
  - tracks added/removed
  - devices added/removed
  - tempo/time signature changes
  - clip count / scene count changes when feasible
- project health checks:
  - missing files
  - duplicate large assets
  - suspicious file drift

### 2. Usable history management
- named snapshots / bookmarks
- rollback via project duplication
- snapshot tags like `idea`, `client-ready`, `pre-mix`, `safe point`
- compare any two snapshots from timeline

### 3. Improved desktop UX
- polished project dashboard
- per-project history view
- diff importance scoring
- background agent / tray-first operation
- onboarding that explains history in plain producer language

### 4. Smart automation
- automatic “milestone” snapshots after meaningful project changes
- optional pre-close / pre-export checkpoints
- snapshot retention controls and storage limits

### 5. Collaboration-lite
- exportable revision packages
- share snapshot report with collaborators
- import external snapshot manifests for comparison

### 6. Reliability and distribution
- packaged macOS app
- crash-safe local database
- stronger telemetry/logging for support diagnostics (privacy-safe, opt-in)

### v1 success criteria
- users keep Backtrack running in the background during real sessions
- rollback/review becomes part of normal workflow
- “what changed?” is answered in under 10 seconds
- snapshot creation is trusted and low-noise

---

## v2 Roadmap

v2 is where Backtrack becomes more than history and starts becoming the operating system for Ableton project state.

### 1. Collaboration and sync
- optional cloud sync for snapshot metadata
- team/project sharing
- conflict detection between machines
- collaborator activity timeline

### 2. Branching for producers
- alternate creative branches
- compare branch summaries like “club mix vs acoustic mix”
- merge assistance at asset/session level where feasible

### 3. Audio-aware intelligence
- preview changes between versions
- detect likely audible change categories
- compare rendered bounces against project revisions
- stem/export lineage tracking

### 4. Recovery and portability
- one-click project packaging
- broken-path repair tools
- migration assistant for drives/computers
- archive mode for finished projects

### 5. Ecosystem expansion
- Windows support
- deeper plugin/device metadata support
- potential support for other DAWs only after Ableton fit is strong

### 6. AI-assisted workflow (only if grounded in reliable data)
- summarize what changed in a session in plain language
- detect risky saves or suspicious regressions
- suggest milestone labels based on work pattern

---

## Tech Architecture

## Guiding architecture choice

Backtrack should be **local-first, event-driven, and layered**. The snapshot engine must remain independently testable and deterministic. UI, storage, parsing, and sync should be separable.

### Proposed architecture layers

#### 1. Core snapshot engine
**Current base:** Node/TypeScript snapshot + diff library

Responsibilities:
- file enumeration
- ignore rules
- hashing
- manifest generation
- diffing between manifests
- deterministic outputs for testing

This remains the truth source for project state capture.

#### 2. Ableton project intelligence layer
**Current direction:** parser-lib / `.als` parsing work

Responsibilities:
- parse `.als` metadata
- extract project-level summaries
- later compute semantic change summaries

This turns raw file change data into producer-readable changes.

#### 3. Desktop app shell
**Current direction:** Tauri + React desktop app

Responsibilities:
- onboarding and watched folders UI
- tray/background lifecycle
- notifications
- project timeline and diff views
- local settings management

Tauri is a good fit because it keeps the desktop footprint reasonable while allowing a native-feeling background utility.

#### 4. Local persistence layer
**Recommended for MVP/v1:** SQLite database + snapshot manifests on disk

Store:
- watched folders
- project records
- snapshot metadata
- parser summaries
- event logs
- retention policies

Why this matters:
- timeline queries become fast
- avoids loose-file chaos as history grows
- supports future sync without changing the local contract

#### 5. File watcher / job coordinator
Responsibilities:
- watch project folders
- debounce save events
- queue snapshot jobs
- avoid duplicate work
- handle lock/contention edge cases

#### 6. Optional backend/cloud layer (v2+)
Responsibilities:
- account sync
- cross-device history metadata
- team sharing
- analytics and support tooling

Cloud should sync metadata first, not become a blocker for core use.

### Data model (high level)

**Project**
- id
- root path
- display name
- created/updated timestamps

**Snapshot**
- id
- project id
- created at
- trigger source (auto/manual/milestone)
- manifest path
- summary metadata
- retention/bookmark state

**Diff**
- snapshot before
- snapshot after
- added/removed/changed files
- semantic change summary
- importance score

**Asset health**
- missing references
- duplicate assets
- external path warnings

### Key technical decisions

- **Local-first storage:** user trust depends on offline reliability
- **Deterministic manifests:** necessary for testability and diff accuracy
- **Hybrid storage model:** file manifests for auditability, DB for speed and UX
- **Semantic parsing as a separate layer:** keeps snapshot engine stable even if parser evolves
- **Background-first desktop design:** producers should not need to actively “use” the app every time

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Why it matters | Mitigation |
|---|---:|---:|---|---|
| `.als` parsing complexity or format edge cases` | Medium | High | Semantic diffs become unreliable if parser coverage is weak | Ship MVP on file-level diffs first; gate semantic features behind validated parser coverage |
| Excessive snapshot noise from frequent saves | High | High | Users will ignore Backtrack if it feels noisy or bloated | Debounce aggressively, batch events, create milestone heuristics, retention controls |
| Large projects create slow hashing/storage growth | High | Medium | Backtrack may feel heavy on real-world sessions | Incremental hashing, caching by mtime/size/hash, storage quotas, background prioritization |
| Users expect full “undo Ableton” restore too early | Medium | High | Product trust drops if marketing overpromises | Position early versions as history + recovery + compare, not full merge/undo magic |
| Missing asset detection is incomplete | Medium | High | Recovery workflows fail at critical moments | Prioritize asset health checks in v1 and test against real project sets |
| Cross-machine/cloud sync creates conflicts | Medium | Medium | Hard-to-debug trust failures | Keep cloud optional and metadata-first until local model is stable |
| Tauri/background watcher reliability issues on macOS | Medium | Medium | Core automation breaks silently | Add logs, health indicators, self-check status, fixture testing on long-running sessions |
| Producer UX becomes too technical | Medium | High | Main audience churns | Avoid Git terms in UI, test language with producers, optimize for “confidence” not “control” |
| Legal/privacy concerns around project metadata | Low | Medium | Sensitive client work must stay private | Local-first default, explicit opt-in for sync/telemetry, clear data boundaries |

---

## Milestones

## Milestone 0 — Foundation audit and product framing (current -> next 1-2 weeks)

**Goal:** turn existing code into a clear product direction and validated technical baseline.

Deliverables:
- product plan and role breakdown
- repo architecture review
- confirm current snapshot/diff engine behavior
- define canonical sample Ableton project fixtures
- decide local storage strategy (likely SQLite + manifest files)

Exit criteria:
- roadmap approved
- success metrics agreed
- known technical gaps documented

## Milestone 1 — MVP core automation (2-4 weeks)

**Goal:** automatic snapshots from watched project folders.

Deliverables:
- stable folder watch service
- snapshot job queue/debounce
- local snapshot storage layout
- project registry and settings persistence
- basic desktop status UI

Exit criteria:
- user can watch a folder and get reliable local snapshots without CLI

## Milestone 2 — History and diff UX (3-5 weeks)

**Goal:** make captured history understandable and useful.

Deliverables:
- snapshot timeline
- diff viewer for added/removed/changed files
- project summaries in UI
- open/export snapshot actions
- error handling and logs visible in app

Exit criteria:
- user can answer “what changed?” inside the desktop app

## Milestone 3 — Ableton-aware intelligence (3-6 weeks)

**Goal:** make diffs music-meaningful instead of file-meaningful.

Deliverables:
- richer `.als` metadata extraction
- semantic change summaries
- health checks for missing/referenced assets
- diff importance scoring

Exit criteria:
- user sees project-level changes like tracks/devices/tempo shifts where supported

## Milestone 4 — v1 polish and trust (2-4 weeks)

**Goal:** package a product people can actually run daily.

Deliverables:
- tray-first UX polish
- named snapshots/bookmarks
- retention settings
- packaged app builds
- reliability pass on long sessions and large projects

Exit criteria:
- private alpha users can run Backtrack on active projects for multiple days

## Milestone 5 — v2 expansion (post-v1)

**Goal:** collaboration, sync, and advanced project intelligence.

Deliverables:
- optional cloud metadata sync
- branch concepts / alternate versions
- project packaging and portability tools
- audio-aware features

Exit criteria:
- Backtrack evolves from personal history tool to collaborative production infrastructure

---

## Suggested Success Metrics

### MVP metrics
- first snapshot created within 5 minutes of setup
- 95%+ successful snapshot jobs in test sessions
- diff generated in under 3 seconds for normal projects
- at least 80% of test users report increased confidence experimenting in Ableton

### v1 metrics
- weekly active producers keep app enabled during sessions
- reduction in manual duplicate-version naming behavior
- successful recovery/export actions used in real workflows
- meaningful semantic diffs shown on a majority of active projects

---

## Strategic Notes

- The wedge is not “Git for music.” That phrase is technically understandable but emotionally wrong for most producers.
- The first magical moment is not collaboration. It is **seeing history appear automatically after you save**.
- The second magical moment is **understanding what changed without opening ten duplicate project folders**.
- Backtrack should optimize for trust before cleverness. If users trust history capture, everything else can layer on top.
