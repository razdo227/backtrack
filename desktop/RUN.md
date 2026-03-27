# How to Run Backtrack Desktop

## Quick Start

### 1. Navigate to the desktop folder
```bash
cd /Users/avadhootkolee/Documents/Development/backtrack/desktop
```

### 2. Run in Development Mode
```bash
npm run tauri:dev
```

**⏱️ First Run:** The first time you run this, it will take **5-10 minutes** to compile all Rust dependencies (463 packages). Subsequent runs will be much faster (10-30 seconds).

**What you'll see:**
- ✅ Vite dev server starts on http://localhost:1420
- ✅ Rust compilation progress (Building [====] 368/463...)
- ✅ When complete, the app window will automatically open
- ✅ A system tray icon (🎵) will appear in your macOS menubar

### 3. What to Expect

Once the app opens:

1. **Main Window:**
   - Dark themed interface
   - "Watched Folders" section (empty initially)
   - "Recent Changes" section (empty initially)
   - "Debug Tools" expandable panel

2. **System Tray Icon:**
   - Click the music note icon in your menubar
   - Menu options:
     - Open Dashboard
     - Quit Backtrack

### 4. Testing the App

#### A. Add a Watched Folder
1. Click the "+ Add Folder" button
2. Select your Ableton projects folder (e.g., `~/Music/Ableton/Projects`)
3. The folder will appear in the "Watched Folders" list

#### B. Test File Detection
1. Open an Ableton project from the watched folder
2. Make some changes (add a track, add a device)
3. Save the project in Ableton
4. **Wait 30 seconds** (debounce delay)
5. You should see:
   - A macOS notification: "Backtrack: filename.als - 4 tracks, 8 devices"
   - The change appears in "Recent Changes" section

#### C. Manual Parse Test
1. Click "Debug Tools" to expand
2. Click "Test Parse File"
3. Select any `.als` file
4. See the parsed JSON output

### 5. Common Issues

#### Issue: "error: could not compile"
**Solution:** Let the first compilation complete fully. Don't interrupt it.

#### Issue: App doesn't detect changes
**Checks:**
- Did you wait 30 seconds after saving?
- Is the file actually changing? (Ableton sometimes saves without changes)
- Check logs: `~/Library/Logs/Backtrack/backtrack.log`

#### Issue: No system tray icon
**Solution:** The icon appears only after compilation completes successfully.

### 6. View Logs

```bash
tail -f ~/Library/Logs/Backtrack/backtrack.log
```

Logs show:
- File watcher events
- Parsing operations
- Hash calculations
- Errors and warnings

### 7. Stop the App

**From Terminal:**
- Press `Ctrl+C` in the terminal where you ran `npm run tauri:dev`

**From App:**
- Click the system tray icon → "Quit Backtrack"
- Or press `Cmd+Q` when the window is focused

### 8. Settings Persistence

Your settings are automatically saved to:
```
~/Library/Application Support/com.backtrack.app/settings.json
```

This includes:
- Watched folders list
- Preferences

Settings persist across app restarts.

## Build for Production (Optional)

```bash
npm run tauri:build
```

This creates a standalone app at:
```
src-tauri/target/release/bundle/macos/Backtrack.app
```

You can then move it to `/Applications`.

## Project Structure

```
desktop/
├── src/                    # React/TypeScript frontend
│   ├── App.tsx            # Main component
│   ├── components/        # UI components
│   ├── hooks/             # Custom hooks (Tauri integration)
│   └── types.ts           # TypeScript types
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   ├── commands.rs    # Tauri commands
│   │   ├── file_watcher.rs # File watching logic
│   │   ├── state.rs       # App state
│   │   ├── tray.rs        # System tray
│   │   └── utils.rs       # Utilities (SHA256)
│   └── Cargo.toml         # Rust dependencies
└── package.json           # NPM scripts

```

## Key Features

✅ **File Watching:** Monitors `.als` files recursively in watched folders
✅ **Debouncing:** Waits 30s after last change before parsing
✅ **SHA256 Hashing:** Only parses if file content actually changed
✅ **Parser Integration:** Uses `backtrack-parser` library
✅ **macOS Notifications:** Shows native notifications on parse
✅ **Settings Persistence:** Remembers watched folders
✅ **System Tray:** Menubar app behavior
✅ **Type Safety:** Full TypeScript on frontend

## Next Steps

Once tested, you can:
- Adjust debounce delay in code (currently 30s)
- Add more UI features
- Integrate with backend API (Phase 5)
- Add diff calculation (Phase 4)
- Build production app and distribute

---

**Need Help?**
- Check logs: `~/Library/Logs/Backtrack/backtrack.log`
- Frontend console: Open DevTools in the app window (Cmd+Option+I)
- Rust logs: Shown in terminal during `npm run tauri:dev`
