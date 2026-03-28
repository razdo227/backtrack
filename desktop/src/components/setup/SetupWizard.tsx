import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, Clock, CheckCircle, ChevronRight, HardDrive, Sparkles, Save } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../store/appStore';
import type { SnapshotFrequency } from '../../store/appStore';

const STEPS = [
  { id: 1, label: 'Projects folder' },
  { id: 2, label: 'Backup settings' },
  { id: 3, label: 'All set!' },
] as const;

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

export function SetupWizard() {
  const {
    setupStep,
    projectsFolder,
    storageDir,
    snapshotFrequency,
    maxSnapshots,
    setSetupStep,
    setProjectsFolder,
    setStorageDir,
    setSnapshotFrequency,
    setMaxSnapshots,
    completeSetup,
  } = useAppStore();

  const [direction, setDirection] = useState(1);
  const [pickingFolder, setPickingFolder] = useState(false);
  const [pickingStorage, setPickingStorage] = useState(false);
  const [starting, setStarting] = useState(false);

  const goTo = (step: 1 | 2 | 3) => {
    setDirection(step > setupStep ? 1 : -1);
    setSetupStep(step);
  };

  const next = () => {
    if (setupStep < 3) goTo((setupStep + 1) as 1 | 2 | 3);
  };

  const back = () => {
    if (setupStep > 1) goTo((setupStep - 1) as 1 | 2 | 3);
  };

  const pickProjectsFolder = async () => {
    setPickingFolder(true);
    try {
      const folder = await open({ directory: true, multiple: false, title: 'Select Ableton Projects Folder' });
      if (folder) setProjectsFolder(folder);
    } finally {
      setPickingFolder(false);
    }
  };

  const pickStorageDir = async () => {
    setPickingStorage(true);
    try {
      const folder = await open({ directory: true, multiple: false, title: 'Select Backup Storage Location' });
      if (folder) setStorageDir(folder);
    } finally {
      setPickingStorage(false);
    }
  };

  const canGoNext = setupStep === 1 ? !!projectsFolder : true;

  return (
    <div className="fixed inset-0 z-[900] bg-zinc-950 flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/10 via-zinc-950 to-purple-950/10" />

      {/* Header */}
      <div className="relative flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-white">Backtrack Setup</span>
        </div>

        {/* Step dots */}
        <div className="flex items-center gap-2">
          {STEPS.map((step) => (
            <div key={step.id} className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full transition-all duration-300 ${
                  step.id < setupStep
                    ? 'bg-indigo-400'
                    : step.id === setupStep
                    ? 'bg-indigo-500 scale-125'
                    : 'bg-zinc-700'
                }`}
              />
              {step.id < STEPS.length && (
                <div className={`h-px w-6 transition-colors duration-300 ${step.id < setupStep ? 'bg-indigo-500/60' : 'bg-zinc-800'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="w-32" /> {/* spacer */}
      </div>

      {/* Content */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden px-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={setupStep}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="w-full max-w-lg"
          >
            {setupStep === 1 && (
              <Step1
                projectsFolder={projectsFolder}
                onPick={pickProjectsFolder}
                isPicking={pickingFolder}
              />
            )}
            {setupStep === 2 && (
              <Step2
                frequency={snapshotFrequency}
                maxSnapshots={maxSnapshots}
                storageDir={storageDir}
                onFrequencyChange={setSnapshotFrequency}
                onMaxSnapshotsChange={setMaxSnapshots}
                onStoragePick={pickStorageDir}
                isPickingStorage={pickingStorage}
              />
            )}
            {setupStep === 3 && (
              <Step3
                projectsFolder={projectsFolder}
                frequency={snapshotFrequency}
                maxSnapshots={maxSnapshots}
                storageDir={storageDir}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="relative flex items-center justify-between px-8 py-6">
        <button
          onClick={back}
          disabled={setupStep === 1}
          className="h-10 px-5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white disabled:opacity-0 disabled:pointer-events-none transition"
        >
          Back
        </button>

        <div className="text-xs text-zinc-600">
          Step {setupStep} of {STEPS.length}
        </div>

        {setupStep < 3 ? (
          <button
            onClick={next}
            disabled={!canGoNext}
            className="h-10 px-6 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            Continue <ChevronRight size={14} />
          </button>
        ) : (
          <button
            onClick={async () => {
              if (!projectsFolder) { completeSetup(); return; }
              setStarting(true);
              try {
                // Register the folder with the Tauri backend file-watcher and
                // kick off an initial project scan before navigating to main.
                await invoke('add_watched_folder', { folder: projectsFolder }).catch(() => {});
                await invoke('scan_for_projects', { path: projectsFolder }).catch(() => {});
              } finally {
                setStarting(false);
              }
              completeSetup();
            }}
            disabled={starting}
            className="h-10 px-6 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition flex items-center gap-2"
          >
            {starting ? (
              <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <CheckCircle size={14} />
            )}
            {starting ? 'Scanning…' : 'Start Backtrack'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Step 1: Select projects folder ─────────────────────────────────────────────

function Step1({
  projectsFolder,
  onPick,
  isPicking,
}: {
  projectsFolder: string | null;
  onPick: () => void;
  isPicking: boolean;
}) {
  const displayPath = projectsFolder
    ? projectsFolder.replace(/^\/Users\/[^/]+/, '~')
    : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center">
          <Folder size={18} className="text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Select your Ableton projects folder</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            This is the parent folder containing all your Ableton project folders.
          </p>
        </div>
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 mb-5">
        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
          Backtrack watches your projects folder and automatically captures snapshots of your Ableton Live files (
          <span className="text-zinc-200">.als</span>) whenever they change. Each snapshot is a full copy of your project state — so you can roll back to any point in time.
        </p>

        {displayPath ? (
          <div className="flex items-center gap-3 bg-zinc-800/60 rounded-lg px-4 py-3">
            <Folder size={15} className="text-indigo-400 shrink-0" />
            <span className="text-sm text-zinc-200 font-mono truncate">{displayPath}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-zinc-800/30 rounded-lg px-4 py-3 border border-dashed border-zinc-700">
            <Folder size={15} className="text-zinc-600 shrink-0" />
            <span className="text-sm text-zinc-600">No folder selected yet</span>
          </div>
        )}
      </div>

      <button
        onClick={onPick}
        disabled={isPicking}
        className="h-10 px-5 rounded-lg text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition flex items-center gap-2 disabled:opacity-50"
      >
        <Folder size={14} />
        {isPicking ? 'Opening…' : projectsFolder ? 'Change folder' : 'Choose folder'}
      </button>
    </div>
  );
}

// ── Step 2: Backup settings ────────────────────────────────────────────────────

const FREQ_OPTIONS: { id: SnapshotFrequency; icon: React.ReactNode; label: string; desc: string }[] = [
  {
    id: 'on-save',
    icon: <Save size={15} />,
    label: 'On every save',
    desc: 'Snapshot taken every time an .als file changes',
  },
  {
    id: 'hourly',
    icon: <Clock size={15} />,
    label: 'Hourly',
    desc: 'One snapshot per project, per hour',
  },
  {
    id: 'manual',
    icon: <CheckCircle size={15} />,
    label: 'Manual only',
    desc: 'You control when snapshots are taken',
  },
];

function Step2({
  frequency,
  maxSnapshots,
  storageDir,
  onFrequencyChange,
  onMaxSnapshotsChange,
  onStoragePick,
  isPickingStorage,
}: {
  frequency: SnapshotFrequency;
  maxSnapshots: number;
  storageDir: string;
  onFrequencyChange: (f: SnapshotFrequency) => void;
  onMaxSnapshotsChange: (n: number) => void;
  onStoragePick: () => void;
  isPickingStorage: boolean;
}) {
  const displayStorage = storageDir.replace(/^\/Users\/[^/]+/, '~');

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center">
          <HardDrive size={18} className="text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Backup settings</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Configure how and when Backtrack saves snapshots.</p>
        </div>
      </div>

      {/* Frequency options */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 block">
          Auto-snapshot frequency
        </label>
        <div className="space-y-2">
          {FREQ_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onFrequencyChange(opt.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl border transition text-left ${
                frequency === opt.id
                  ? 'border-indigo-500/60 bg-indigo-950/30 text-white'
                  : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <span className={frequency === opt.id ? 'text-indigo-400' : 'text-zinc-600'}>
                {opt.icon}
              </span>
              <div>
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-zinc-500">{opt.desc}</div>
              </div>
              {frequency === opt.id && (
                <div className="ml-auto h-2 w-2 rounded-full bg-indigo-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Max snapshots slider */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Max snapshots to keep</span>
          <span className="text-indigo-400 font-bold">{maxSnapshots}</span>
        </label>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={maxSnapshots}
          onChange={(e) => onMaxSnapshotsChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full bg-zinc-800 appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <div className="flex justify-between text-xs text-zinc-600 mt-1">
          <span>10</span>
          <span>100</span>
        </div>
      </div>

      {/* Storage location */}
      <div>
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 block">
          Storage location
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-zinc-900/60 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-400 font-mono truncate">
            {displayStorage}
          </div>
          <button
            onClick={onStoragePick}
            disabled={isPickingStorage}
            className="h-10 px-3 rounded-lg text-sm text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition shrink-0 disabled:opacity-50"
          >
            Change
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Summary ────────────────────────────────────────────────────────────

function Step3({
  projectsFolder,
  frequency,
  maxSnapshots,
  storageDir,
}: {
  projectsFolder: string | null;
  frequency: SnapshotFrequency;
  maxSnapshots: number;
  storageDir: string;
}) {
  const freqLabel = { 'on-save': 'On every save', hourly: 'Hourly', manual: 'Manual only' };

  return (
    <div>
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-900/40"
        >
          <CheckCircle size={28} className="text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold text-white">You're all set!</h2>
        <p className="text-sm text-zinc-500 mt-2">Here's a summary of your configuration.</p>
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden">
        <SummaryRow
          icon={<Folder size={14} />}
          label="Projects folder"
          value={projectsFolder?.replace(/^\/Users\/[^/]+/, '~') ?? 'Not set'}
        />
        <SummaryRow
          icon={<Clock size={14} />}
          label="Auto-snapshot"
          value={freqLabel[frequency]}
        />
        <SummaryRow
          icon={<HardDrive size={14} />}
          label="Max snapshots"
          value={`${maxSnapshots} per project`}
        />
        <SummaryRow
          icon={<HardDrive size={14} />}
          label="Storage"
          value={storageDir.replace(/^\/Users\/[^/]+/, '~')}
          last
        />
      </div>

      <p className="text-xs text-zinc-600 text-center mt-4">
        You can change these settings anytime from the Settings panel.
      </p>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 ${!last ? 'border-b border-zinc-800/80' : ''}`}>
      <span className="text-zinc-500">{icon}</span>
      <span className="text-sm text-zinc-500 w-32 shrink-0">{label}</span>
      <span className="text-sm text-zinc-200 font-medium truncate">{value}</span>
    </div>
  );
}
