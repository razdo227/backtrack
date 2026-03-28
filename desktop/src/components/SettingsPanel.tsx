import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Folder, Clock, HardDrive, Moon, Sun, LogOut, Save } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useUser, useClerk, useAuth } from '@clerk/clerk-react';
import { useAppStore } from '../store/appStore';
import type { SnapshotFrequency } from '../store/appStore';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const FREQ_OPTIONS: { id: SnapshotFrequency; label: string }[] = [
  { id: 'on-save', label: 'On every save' },
  { id: 'hourly', label: 'Hourly' },
  { id: 'manual', label: 'Manual only' },
];

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const {
    projectsFolder,
    storageDir,
    snapshotFrequency,
    maxSnapshots,
    setProjectsFolder,
    setStorageDir,
    setSnapshotFrequency,
    setMaxSnapshots,
  } = useAppStore();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark'; }
    catch { return 'dark'; }
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  const pickProjectsFolder = async () => {
    const folder = await open({ directory: true, multiple: false, title: 'Select Ableton Projects Folder' });
    if (folder) setProjectsFolder(folder);
  };

  const pickStorageDir = async () => {
    const folder = await open({ directory: true, multiple: false, title: 'Select Storage Location' });
    if (folder) setStorageDir(folder);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Settings</h2>
              <button
                onClick={onClose}
                className="h-7 w-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <Section title="Projects Folder" icon={<Folder size={13} />}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-zinc-800/60 rounded-lg px-3 py-2 text-xs text-zinc-400 font-mono truncate min-w-0">
                    {projectsFolder ? projectsFolder.replace(/^\/Users\/[^/]+/, '~') : 'Not set'}
                  </div>
                  <button
                    onClick={pickProjectsFolder}
                    className="shrink-0 h-8 px-3 rounded-lg text-xs text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition"
                  >
                    Change
                  </button>
                </div>
              </Section>

              <Section title="Auto-snapshot" icon={<Clock size={13} />}>
                <div className="space-y-1.5">
                  {FREQ_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setSnapshotFrequency(opt.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                        snapshotFrequency === opt.id
                          ? 'bg-indigo-950/50 text-indigo-300 border border-indigo-800/60'
                          : 'bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {snapshotFrequency === opt.id && (
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                      )}
                    </button>
                  ))}
                </div>
              </Section>

              <Section title="Max snapshots" icon={<Save size={13} />}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-500">Per project</span>
                    <span className="text-sm font-bold text-indigo-400">{maxSnapshots}</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={maxSnapshots}
                    onChange={(e) => setMaxSnapshots(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full bg-zinc-800 appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                </div>
              </Section>

              <Section title="Storage location" icon={<HardDrive size={13} />}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-zinc-800/60 rounded-lg px-3 py-2 text-xs text-zinc-400 font-mono truncate min-w-0">
                    {storageDir.replace(/^\/Users\/[^/]+/, '~')}
                  </div>
                  <button
                    onClick={pickStorageDir}
                    className="shrink-0 h-8 px-3 rounded-lg text-xs text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition"
                  >
                    Change
                  </button>
                </div>
              </Section>

              <Section title="Appearance" icon={theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      theme === 'dark' ? 'bg-indigo-600' : 'bg-zinc-700'
                    }`}
                  >
                    <div
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                        theme === 'dark' ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </Section>
            </div>

            <div className="border-t border-zinc-800 p-4">
              {isSignedIn && user ? (
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-400 truncate">{user.primaryEmailAddress?.emailAddress ?? user.username}</div>
                    <div className="text-xs text-zinc-600 mt-0.5">Signed in</div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="h-8 px-3 rounded-lg text-xs text-red-400 bg-red-950/30 hover:bg-red-950/60 transition flex items-center gap-1.5"
                  >
                    <LogOut size={11} />
                    Sign out
                  </button>
                </div>
              ) : (
                <p className="text-xs text-zinc-600 text-center">Not signed in</p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-zinc-600">{icon}</span>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}
