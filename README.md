# Backtrack

A minimal foundation for an Ableton-focused versioning tool.

## What it does right now

- Creates deterministic snapshot manifests for project files
- Hashes tracked files so changes can be detected reliably
- Diffs two manifests into added / removed / changed sets
- Ships with a tiny CLI and test coverage

## Why this is useful

Ableton projects are made of a session file plus a pile of referenced assets. Before building fancy UI or history browsing, Backtrack needs a trustworthy core that can answer:

1. What files belong to this project snapshot?
2. What changed between two points in time?
3. Can we automate this repeatably in CI/tests?

This repo now answers those questions.

## CLI

```bash
npm install
npm run build

# Print a snapshot manifest
node dist/cli.js snapshot /path/to/project

# Write a snapshot to disk
node dist/cli.js snapshot /path/to/project snapshots/take-001.json

# Diff two snapshots
node dist/cli.js diff snapshots/take-001.json snapshots/take-002.json
```

## Development

```bash
npm install
npm test
npm run build
```

## Ignoring project-specific files

Create a `.backtrackignore` file at the project root to exclude folders or files from snapshots.

```txt
# Skip renders and bounced stems
Exports
Stems/final
```

## Next sensible steps

- Parse `.als` metadata for richer project summaries
- Add a watch mode that creates snapshots automatically
- Store snapshots in a local history database instead of loose JSON files
- Build a simple desktop UI around the diff engine
