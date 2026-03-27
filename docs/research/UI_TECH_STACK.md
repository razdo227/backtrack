# UI Tech Stack Research — Tauri + React (macOS)

Goal: minimalistic, fast, native‑feeling desktop app for macOS using Tauri + React. This is a curated stack shortlist with options and rationale.

---

## 1) UI Component Libraries (Tauri‑friendly)

**Primary recommendation: Shadcn UI + Radix + Tailwind**
- **shadcn/ui**: Copy‑paste components (no heavy runtime), easy to theme for minimal UI.
- **Radix UI**: Accessible, unstyled primitives. Great for popovers, dialogs, menus.
- **Tailwind CSS**: Fast iteration, minimal CSS footprint; works cleanly with Tauri.
- **Why**: Minimal JS overhead, easy to keep the app light, consistent macOS vibe.

**Alternatives**
- **Mantine**: Rich components but heavier; can feel webby in desktop.
- **Chakra UI**: Easy, but adds runtime theming + heavy bundle for desktop.
- **MUI**: Powerful; likely too heavy/“web” for minimalistic desktop UX.

**Suggested baseline**
- Tailwind + shadcn/ui + Radix + class-variance-authority (CVA) for consistent variants.

---

## 2) Auth Options for Tauri Desktop Apps

**Option A — Supabase Auth (recommended)**
- Pros: easy OAuth/email/password, JWTs, real-time, RLS, simple to integrate.
- Cons: Cloud dependency.

**Option B — Firebase Auth**
- Pros: Mature, lots of providers, reliable.
- Cons: Tighter vendor lock‑in; desktop may need extra config for OAuth flows.

**Option C — Custom JWT + API**
- Pros: Full control; works offline or with local licensing models.
- Cons: Need to build auth, refresh tokens, password reset flows.

**Option D — Local license key / offline auth**
- Pros: Works without internet, good for desktop.
- Cons: Must handle license verification & sync later.

**Practical recommendation**
- If server already exists: **custom JWT** with refresh tokens.
- If fast setup: **Supabase**.

---

## 3) File System APIs in Tauri (watch Ableton folders)

**Tauri core FS APIs**
- `@tauri-apps/api/fs` — read/write, readDir, watch (via `watch` / `watchImmediate`).
- Works with native file paths, supports macOS sandbox permissions.

**Recommended approach**
- Use **Tauri `fs.watch`** for folder watching (Ableton project folder).
- Optionally integrate **Rust side** with `notify` crate for more advanced patterns.

**Notes**
- On macOS, you’ll need file access permissions (Tauri allowlist + entitlements).
- If user selects folder via dialog, you can retain access via `fs` and keep watchers.

---

## 4) State Management

**Recommended: Zustand**
- Tiny, easy to reason about, minimal boilerplate.
- Works great for desktop apps with global state.

**Alternative: Jotai**
- More atomic + flexible; can be great for complex derived state.

**If you want more structure**
- **Redux Toolkit**: heavier but battle‑tested.

**Pick**: **Zustand** (default), switch to Jotai if you want atomized state.

---

## 5) Animation / Transitions

**Recommended: Framer Motion**
- Smooth, declarative, works with React + Tailwind.
- Great for subtle transitions, nav highlights, panel reveals.

**Alternative: React Spring**
- More physics‑based; may be too much for minimal UI.

**Notes**
- Keep animations subtle for macOS feel (short durations, low easing).

---

## 6) Publishing macOS .dmg / .pkg via GitHub Releases

**Tauri Build Targets**
- `tauri build` generates `.app`.
- Use **tauri-bundler** to produce `.dmg` or `.pkg`.

**Typical flow**
1. Configure `tauri.conf.json` for macOS bundle settings.
2. Build signed app with proper Apple certs (Developer ID).
3. Use `tauri build --target x86_64-apple-darwin` or `aarch64-apple-darwin`.
4. Upload generated `.dmg` to GitHub Releases.

**Automation**
- Use **GitHub Actions** with `tauri-apps/tauri-action` to build + release.
- Action supports macOS builds + auto upload to GitHub Releases.

---

## Suggested Minimal Stack

- **UI**: Tailwind + shadcn/ui + Radix
- **State**: Zustand
- **Animation**: Framer Motion (only for subtle transitions)
- **Auth**: Supabase (fast) or custom JWT (control)
- **File watching**: Tauri fs watch; Rust `notify` if needed
- **Release**: GitHub Actions + tauri-action for DMG

---

## Next Steps

- Decide auth model (Supabase vs custom JWT).
- Define macOS permissions + entitlements early for file watching.
- Prototype minimal UI shell using shadcn + Radix.
