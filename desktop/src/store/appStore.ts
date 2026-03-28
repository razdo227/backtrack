import { create } from 'zustand';

export type SnapshotFrequency = 'on-save' | 'hourly' | 'manual';

export type Screen = 'auth' | 'setup' | 'main';

export interface Snapshot {
  id: string;
  timestamp: string;
  filesChanged: number;
  sizeDelta: number; // bytes
  label?: string;
}

interface AppState {
  // Navigation
  screen: Screen;
  setupStep: 1 | 2 | 3;
  isSettingsOpen: boolean;
  isAuthSkipped: boolean;

  // Config
  projectsFolder: string | null;
  storageDir: string;
  snapshotFrequency: SnapshotFrequency;
  maxSnapshots: number;

  // Runtime
  selectedProjectPath: string | null;
  isWatching: boolean;

  // Actions
  setScreen: (screen: Screen) => void;
  setSetupStep: (step: 1 | 2 | 3) => void;
  setProjectsFolder: (path: string) => void;
  setStorageDir: (dir: string) => void;
  setSnapshotFrequency: (freq: SnapshotFrequency) => void;
  setMaxSnapshots: (count: number) => void;
  setSelectedProject: (path: string | null) => void;
  setIsWatching: (watching: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setAuthSkipped: (skipped: boolean) => void;
  completeSetup: () => void;
}

const STORAGE_KEY = 'backtrack.app.state';

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function persistState(state: Partial<AppState>) {
  try {
    const persisted = {
      screen: state.screen,
      projectsFolder: state.projectsFolder,
      storageDir: state.storageDir,
      snapshotFrequency: state.snapshotFrequency,
      maxSnapshots: state.maxSnapshots,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // ignore
  }
}

const saved = loadPersistedState();

export const useAppStore = create<AppState>((set) => ({
  screen: (saved.screen as Screen) ?? 'auth',
  setupStep: 1,
  isSettingsOpen: false,
  isAuthSkipped: false,
  projectsFolder: saved.projectsFolder ?? null,
  storageDir: saved.storageDir ?? `${(globalThis as { __HOME__?: string }).__HOME__ ?? '~'}/.backtrack`,
  snapshotFrequency: (saved.snapshotFrequency as SnapshotFrequency) ?? 'on-save',
  maxSnapshots: saved.maxSnapshots ?? 50,
  selectedProjectPath: null,
  isWatching: false,

  setScreen: (screen) => {
    set((state) => {
      persistState({ ...state, screen });
      return { screen };
    });
  },
  setSetupStep: (setupStep) => set({ setupStep }),
  setProjectsFolder: (projectsFolder) => {
    set((state) => {
      persistState({ ...state, projectsFolder });
      return { projectsFolder };
    });
  },
  setStorageDir: (storageDir) => {
    set((state) => {
      persistState({ ...state, storageDir });
      return { storageDir };
    });
  },
  setSnapshotFrequency: (snapshotFrequency) => {
    set((state) => {
      persistState({ ...state, snapshotFrequency });
      return { snapshotFrequency };
    });
  },
  setMaxSnapshots: (maxSnapshots) => {
    set((state) => {
      persistState({ ...state, maxSnapshots });
      return { maxSnapshots };
    });
  },
  setSelectedProject: (selectedProjectPath) => set({ selectedProjectPath }),
  setIsWatching: (isWatching) => set({ isWatching }),
  setIsSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
  setAuthSkipped: (isAuthSkipped) => set({ isAuthSkipped }),
  completeSetup: () => {
    set((state) => {
      persistState({ ...state, screen: 'main' });
      return { screen: 'main' };
    });
  },
}));
