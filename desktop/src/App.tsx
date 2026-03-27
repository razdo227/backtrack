import { useEffect, useMemo, useState } from 'react';
import { Settings, UserCircle } from 'lucide-react';
import { useTauri } from './hooks/useTauri';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';
import { Timeline } from './components/layout/Timeline';
import { SettingsModal } from './components/SettingsModal';
import { Onboarding } from './components/Onboarding';

const TIMELINE_WIDTH_KEY = 'backtrack.timeline.width';
const ONBOARDING_COMPLETED_KEY = 'backtrack.onboarding.completed';

function readTimelineWidth(): number {
  try {
    const raw = localStorage.getItem(TIMELINE_WIDTH_KEY);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : 320;
  } catch {
    return 320;
  }
}

function writeTimelineWidth(width: number) {
  try {
    localStorage.setItem(TIMELINE_WIDTH_KEY, String(width));
  } catch {
    // ignore
  }
}

function readOnboardingCompleted(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeOnboardingCompleted() {
  try {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, '1');
  } catch {
    // ignore
  }
}

function App() {
  const {
    watchedFolders,
    recentChanges,
    scannedProjects,
    isScanning,
    isLoading,
    addFolder,
    // refresh,
  } = useTauri();

  const [selectedProjectPath, setSelectedProjectPath] = useState<string | undefined>(undefined);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'account' | 'debug'>('general');
  const [timelineWidth, setTimelineWidth] = useState(() => readTimelineWidth());
  const [onboardingCompleted, setOnboardingCompleted] = useState(() => readOnboardingCompleted());

  // Use scanned projects if available, otherwise fall back to watched folders
  const displayProjects = useMemo(
    () => (scannedProjects.length > 0 ? scannedProjects : watchedFolders),
    [scannedProjects, watchedFolders],
  );

  useEffect(() => {
    writeTimelineWidth(timelineWidth);
  }, [timelineWidth]);

  useEffect(() => {
    const clampToWindow = () => {
      const max = Math.max(240, Math.min(720, window.innerWidth - 420));
      setTimelineWidth((w) => Math.max(240, Math.min(max, w)));
    };
    window.addEventListener('resize', clampToWindow);
    clampToWindow();
    return () => window.removeEventListener('resize', clampToWindow);
  }, []);

  const showOnboarding = !isLoading && watchedFolders.length === 0 && !onboardingCompleted;

  // Keep selection stable across sorting/updates
  useEffect(() => {
    if (displayProjects.length === 0) {
      setSelectedProjectPath(undefined);
      return;
    }

    setSelectedProjectPath((prev) =>
      prev && displayProjects.includes(prev) ? prev : displayProjects[0],
    );
  }, [displayProjects]);

  // Derive current project title and path
  const currentProjectPath = selectedProjectPath;
  const currentProjectName = currentProjectPath?.split(/[\\/]/).pop() || "Select a Project";

  const handleCommit = (summary: string, desc: string) => {
    console.log("Commit:", summary, desc);
    alert("Commit functionality mocked for now. Check console.");
  };

  const openSettings = (tab: 'general' | 'account' | 'debug') => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  };

  const startResizeTimeline = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = timelineWidth;

    const maxWidth = () => Math.max(240, Math.min(720, window.innerWidth - 420));

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e: PointerEvent) => {
      const delta = startX - e.clientX;
      const next = startWidth + delta;
      setTimelineWidth(Math.max(240, Math.min(maxWidth(), next)));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  return (
    <div className="h-screen w-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white flex flex-col overflow-hidden font-sans">
      <SettingsModal
        isOpen={isSettingsOpen}
        initialTab={settingsInitialTab}
        onClose={() => setIsSettingsOpen(false)}
      />
      {showOnboarding && (
        <Onboarding
          watchedFolders={watchedFolders}
          scannedProjectsCount={scannedProjects.length}
          isScanning={isScanning}
          onAddFolder={addFolder}
          onComplete={() => {
            writeOnboardingCompleted();
            setOnboardingCompleted(true);
          }}
        />
      )}

      {isLoading && <LoadingOverlay label="Loading Backtrack…" />}

      {/* Title Bar / Header (Global) */}
      <header className="h-10 bg-zinc-100/95 dark:bg-zinc-900/95 border-b border-zinc-300 dark:border-zinc-800 flex items-center justify-between px-4 shrink-0 drag-region">
        <button
          onClick={() => openSettings('account')}
          className="text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
          title="Account"
          aria-label="Account"
        >
          <UserCircle size={14} />
        </button>

        <button
          onClick={() => openSettings('general')}
          className="text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <Settings size={14} />
        </button>
      </header>

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Projects */}
        <Sidebar 
          projects={displayProjects}
          onAddFolder={() => openSettings('general')} // Open settings to add folder
          selectedProjectPath={selectedProjectPath}
          onSelectProject={setSelectedProjectPath}
        />

        {/* Center: Detail View */}
        <MainContent
          projectTitle={currentProjectName}
          projectPath={currentProjectPath}
          onCommit={handleCommit}
          // Mocking changes for MainContent until we have a real "current changes" API
          // Using undefined or empty array will trigger internal mock data in component for visualization
          changes={[]}
        />

        {/* Resize handle + Right Sidebar: Timeline */}
        <div
          onPointerDown={startResizeTimeline}
          className="w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          title="Resize timeline"
          aria-label="Resize timeline"
          role="separator"
          aria-orientation="vertical"
        />
        <div className="shrink-0" style={{ width: timelineWidth }}>
          <Timeline changes={recentChanges} />
        </div>
      </div>
    </div>
  );
}

export default App;

function LoadingOverlay({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-40 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center">
      <div className="flex items-center gap-3 rounded-lg border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 shadow-lg">
        <span className="inline-block h-4 w-4 rounded-full border-2 border-zinc-400 dark:border-zinc-600 border-t-transparent animate-spin" />
        <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
      </div>
    </div>
  );
}
