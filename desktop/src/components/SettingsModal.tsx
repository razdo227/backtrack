import { useState, useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { X, Moon, Sun, Folder, Bug, UserCircle } from 'lucide-react';
import { useTauri } from '../hooks/useTauri';
import DebugPanel from './DebugPanel'; // Assuming it's in components root

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'general' | 'account' | 'debug';
}

export function SettingsModal({ isOpen, onClose, initialTab = 'general' }: SettingsModalProps) {
  const { watchedFolders, addFolder, removeFolder, clearAllFolders, parseFile, refresh } = useTauri();
  const [activeTab, setActiveTab] = useState<'general' | 'account' | 'debug'>(initialTab);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Load theme from local storage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      // Default to dark theme
      setTheme('dark');
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[800px] h-[600px] bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl shadow-2xl flex overflow-hidden">

        {/* Sidebar */}
        <div className="w-48 bg-zinc-100 dark:bg-zinc-950 border-r border-zinc-300 dark:border-zinc-800 p-4">
          <h2 className="text-sm font-bold text-zinc-600 dark:text-zinc-400 mb-6 uppercase tracking-wider">Settings</h2>
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors ${
                activeTab === 'general'
                  ? 'bg-zinc-300 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-900'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('account')}
              className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'account'
                  ? 'bg-zinc-300 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-900'
              }`}
            >
              <UserCircle size={14} />
              Account
            </button>
            <button
              onClick={() => setActiveTab('debug')}
              className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'debug'
                  ? 'bg-zinc-300 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-900'
              }`}
            >
              <Bug size={14} />
              Debug
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between p-6 border-b border-zinc-300 dark:border-zinc-800">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
              {activeTab === 'general' ? 'General Settings' : activeTab === 'account' ? 'Account' : 'Debug Console'}
            </h1>
            <button onClick={onClose} className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'general' && (
              <div className="space-y-8">
                {/* Theme Section */}
                <section>
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Appearance</h3>
                  <div className="flex items-center gap-4 bg-zinc-200/50 dark:bg-zinc-950/50 p-4 rounded-lg border border-zinc-300 dark:border-zinc-800">
                    <div className="flex-1">
                      <p className="text-sm text-zinc-900 dark:text-zinc-200 font-medium">Theme Mode</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-500">Toggle between dark and light appearance</p>
                    </div>
                    <button
                      onClick={toggleTheme}
                      className="flex items-center gap-2 px-3 py-1.5 bg-zinc-300 dark:bg-zinc-800 hover:bg-zinc-400 dark:hover:bg-zinc-700 rounded-full border border-zinc-400 dark:border-zinc-600 transition-colors"
                    >
                      {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                      <span className="text-xs font-medium text-zinc-900 dark:text-white capitalize">{theme}</span>
                    </button>
                  </div>
                </section>

                {/* Projects Section */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Ableton Projects Directory</h3>
                    <button
                      onClick={addFolder}
                      className="text-xs flex items-center gap-1 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-3 py-1.5 rounded font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                    >
                      <Folder size={12} />
                      Set Projects Folder
                    </button>
                  </div>

                  <div className="bg-zinc-200/50 dark:bg-zinc-950/50 rounded-lg border border-zinc-300 dark:border-zinc-800 overflow-hidden">
                    {watchedFolders.length === 0 ? (
                      <div className="p-8 text-center text-zinc-600 dark:text-zinc-500 text-sm">
                        No folders configured. Set your Ableton projects directory to start scanning.
                      </div>
                    ) : (
                      <ul className="divide-y divide-zinc-300 dark:divide-zinc-800">
                        {watchedFolders.map((folder) => (
                          <li key={folder} className="flex items-center justify-between p-3">
                            <span className="text-sm text-zinc-800 dark:text-zinc-300 truncate font-mono">{folder}</span>
                            <button
                              onClick={() => removeFolder(folder)}
                              className="text-xs text-red-600 dark:text-red-500 hover:text-red-500 dark:hover:text-red-400 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-500">
                    Setting a parent folder will automatically scan and watch all project subfolders.
                  </p>
                </section>

                <section>
                    <button
                        onClick={clearAllFolders}
                        className="text-xs text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 hover:underline"
                    >
                        Reset All Watched Folders
                    </button>
                </section>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="space-y-4">
                <SignedOut>
                  <div className="rounded-lg border border-zinc-300 dark:border-zinc-800 bg-zinc-200/50 dark:bg-zinc-950/50 p-5">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Sign in</h3>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-500">
                      Sign in to sync and access your account.
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      <SignInButton mode="modal">
                        <button className="h-9 px-4 rounded-md text-sm font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition">
                          Sign in
                        </button>
                      </SignInButton>
                      <SignUpButton mode="modal">
                        <button className="h-9 px-4 rounded-md text-sm font-semibold border border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition">
                          Sign up
                        </button>
                      </SignUpButton>
                    </div>
                  </div>
                </SignedOut>

                <SignedIn>
                  <div className="rounded-lg border border-zinc-300 dark:border-zinc-800 bg-zinc-200/50 dark:bg-zinc-950/50 p-5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Signed in</h3>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-500">
                        Manage your session and profile.
                      </p>
                    </div>
                    <UserButton />
                  </div>
                </SignedIn>
              </div>
            )}

            {activeTab === 'debug' && (
              <DebugPanel 
                onParseFile={parseFile}
                onRefresh={refresh}
                onClearAllFolders={clearAllFolders}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
