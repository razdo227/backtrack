# Repository Guidelines

## Project Structure & Module Organization
- `Cargo.toml` (workspace): defines shared deps and members.
- `parser-lib/`: Ableton `.als` parser library (`src/` code, `examples/`, `tests/`, fixtures under `tests/fixtures/`).
- `backend/`: placeholder crate to keep the workspace valid.
- Generated binaries/examples live under `target/` after builds; do not commit.

## Build, Test, and Development Commands
- `cargo fmt` — format all Rust code.
- `cargo test -p backtrack-parser` — run unit/integration tests for the parser.
- `cargo run -p backtrack-parser --bin parse-als <file.als>` — parse a Live Set and print JSON.
- `cargo run -p backtrack-parser --example basic_usage <file.als>` — example usage for local debugging.

## Coding Style & Naming Conventions
- Rust 2021, follow `rustfmt` defaults (run `cargo fmt` before push).
- Prefer zero/low dependencies; keep parser streaming (`quick-xml`) and avoid unnecessary allocations.
- Names: modules `snake_case`, types `PascalCase`, functions `snake_case`.
- Errors: use `ParserError`; bubble with `?` instead of `unwrap` in library code.

## Testing Guidelines
- Framework: built-in `cargo test`; integration tests in `parser-lib/tests/`.
- Add small gzipped fixtures under `parser-lib/tests/fixtures/`; regenerate via `cargo test -p backtrack-parser --test generate_fixtures -- --ignored` when needed.
- Name tests clearly (`test_<behavior>`); cover success + failure paths (limits, invalid gzip, unsupported versions).

## Commit & Pull Request Guidelines
- Commit messages: concise imperative (e.g., “Add device parsing for racks”).
- PRs should include: summary of changes, testing done (`cargo fmt`, `cargo test ...`), any new fixtures, and notes on backward compatibility.
- Screenshots/logs only if UI/CLI output matters for review.

## Security & Configuration Tips
- No secrets in repo; `.als` fixtures should be non-sensitive and minimal.
- Keep parsing guardrails (`ParseOptions` limits) intact for untrusted inputs.
- Avoid adding heavy dependencies or networked code to the parser crate to keep it portable and embeddable.
