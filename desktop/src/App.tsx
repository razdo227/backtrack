import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings, Radio, PauseCircle, Sparkles } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useTauri } from './hooks/useTauri';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';
import { SettingsPanel } from './components/SettingsPanel';
import { AuthScreen } from './components/auth/AuthScreen';
import { SetupWizard } from './components/setup/SetupWizard';
import { SnapshotTimeline } from './components/layout/SnapshotTimeline';
import { useAppStore } from './store/appStore';
import type { SnapshotEntry } from './components/layout/SnapshotTimeline';
import type { ChangeEvent } from './types';

const TIMELINE_WIDTH_KEY = 'backtrack.timeline.width';

function readTimelineWidth(): number {
  try {
    const raw = localStorage.getItem(TIMELINE_WIDTH_KEY);
    const v = raw ? Number(raw) : NaN;
    return Number.isFinite(v) ? v : 300;
  } catch { return 300; }
}

function changeEventToSnapshot(change: ChangeEvent, index: number): SnapshotEntry {
  return {
    id: change.file_hash ?? `change-${index}`,
    timestamp: change.timestamp,
    filesChanged: change.track_count ?? 1,
    sizeDelta: 0,
    label: change.summary || undefined,
    fileHash: change.file_hash,
  };
}

function initTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  } catch {}
}
initTheme();

export default function App() {
  const { screen, setScreen, isSettingsOpen, setIsSettingsOpen, selectedProjectPath, setSelectedProject, isWatching, projectsFolder } = useAppStore();
  const { isSignedIn } = useAuth();
  const {
    watchedFolders,
    recentChanges,
    scannedProjects,
    isLoading,
    addFolder,
  } = useTauri();

  const [timelineWidth, setTimelineWidth] = useState(readTimelineWidth);

  useEffect(() => {
    if (!isSignedIn) {
      setScreen('auth');
      return;
    }
    if (screen === 'auth') {
      setScreen(projectsFolder ? 'main' : 'setup');
    }
  }, [isSignedIn, screen, setScreen, projectsFolder]);

  useEffect(() => {
    try { localStorage.setItem(TIMELINE_WIDTH_KEY, String(timelineWidth)); }
    catch {}
  }, [timelineWidth]);

  useEffect(() => {
    const clampToWindow = () => {
      const max = Math.max(240, Math.min(680, window.innerWidth - 400));
      setTimelineWidth((w) => Math.max(240, Math.min(max, w)));
    };
    window.addEventListener('resize', clampToWindow);
    clampToWindow();
    return () => window.removeEventListener('resize', clampToWindow);
  }, []);

  const displayProjects = useMemo(
    () => (scannedProjects.length > 0 ? scannedProjects : watchedFolders),
    [scannedProjects, watchedFolders],
  );

  useEffect(() => {
    if (displayProjects.length === 0) {
      setSelectedProject(null);
      return;
    }
    if (selectedProjectPath && displayProjects.includes(selectedProjectPath)) {
      return;
    }
    setSelectedProject(displayProjects[0]);
  }, [displayProjects, selectedProjectPath, setSelectedProject]);

  const currentProjectName = selectedProjectPath?.split(/[\\/]/).pop() || 'Select a Project';

  const snapshots: SnapshotEntry[] = useMemo(
    () => recentChanges.map(changeEventToSnapshot),
    [recentChanges],
  );

  const startResizeTimeline = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = timelineWidth;
    const maxWidth = () => Math.max(240, Math.min(680, window.innerWidth - 400));

    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e: PointerEvent) => {
      const delta = startX - e.clientX;
      setTimelineWidth(Math.max(240, Math.min(maxWidth(), startWidth + delta)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  return (
    <div className="h-screen w-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <AnimatePresence>
        {screen === 'auth' && !isSignedIn && (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AuthScreen />
          </motion.div>
        )}
        {screen === 'setup' && (
          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SetupWizard />
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {isLoading && (
        <div className="fixed inset-0 z-30 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-xl bg-white dark:bg-zinc-900 px-5 py-3 shadow-xl border border-zinc-200 dark:border-zinc-800">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">Loading Backtrack…</span>
          </div>
        </div>
      )}

      <header className="h-10 bg-zinc-50/95 dark:bg-zinc-950/95 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 shrink-0 select-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="h-5 w-5 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles size={10} className="text-white" />
          </div>
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Backtrack</span>
        </div>

        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {selectedProjectPath && (
            <>
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{currentProjectName}</span>
              <div className={`flex items-center gap-1 text-xs ${isWatching ? 'text-emerald-500' : 'text-zinc-500'}`}>
                {isWatching ? <Radio size={10} /> : <PauseCircle size={10} />}
                <span>{isWatching ? 'Watching' : 'Paused'}</span>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => setIsSettingsOpen(true)}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors"
          title="Settings"
        >
          <Settings size={14} />
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          projects={displayProjects}
          onAddFolder={() => { addFolder(); }}
          selectedProjectPath={selectedProjectPath ?? undefined}
          onSelectProject={setSelectedProject}
        />

        <MainContent
          projectTitle={currentProjectName}
          projectPath={selectedProjectPath ?? undefined}
          onCommit={(summary, desc) => {
            console.log('Commit (NYI):', summary, desc);
          }}
          changes={[]}
        />

        <div
          onPointerDown={startResizeTimeline}
          className="w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-indigo-500/20 transition-colors"
          role="separator"
          aria-orientation="vertical"
        />

        <div className="shrink-0 flex flex-col border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950" style={{ width: timelineWidth }}>
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
            <h2 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-widest">Snapshots</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SnapshotTimeline
              projectPath={selectedProjectPath ?? undefined}
              snapshots={snapshots}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
