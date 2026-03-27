import { useState, useEffect } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Database,
  FileCode,
  Info,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { AbletonProject } from '../types';

interface DebugPanelProps {
  onParseFile?: () => Promise<{ success: boolean; result?: AbletonProject; error?: string } | null>;
  onRefresh?: () => void;
  onClearAllFolders?: () => Promise<{ success: boolean; error?: string }>;
}

const ONBOARDING_COMPLETED_KEY = 'backtrack.onboarding.completed';
const DEMO_LOGGED_IN_KEY = 'backtrack.demo.logged_in';

interface SystemInfo {
  platform: string;
  version: string;
  arch: string;
}

export default function DebugPanel({ onParseFile, onRefresh, onClearAllFolders }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [parseResult, setParseResult] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'parse' | 'system' | 'database'>('parse');

  const reloadApp = () => {
    try {
      window.location.reload();
    } catch {
      // ignore
    }
  };

  const clearOnboardingData = () => {
    try {
      localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
      localStorage.removeItem(DEMO_LOGGED_IN_KEY);
    } catch {
      // ignore
    }
  };

  const clearInitializationData = async () => {
    try {
      try {
        await invoke<number>('debug_clear_initialization_data');
      } catch (error) {
        console.error('Failed to remove .backtrack artifacts:', error);
      }

      await invoke('clear_all_watched_folders');
    } catch (error) {
      console.error('Failed to clear watched folders:', error);
      throw error;
    }

    try {
      await invoke('clear_recent_changes');
    } catch {
      // ignore
    }
  };

  const handleParseFile = async () => {
    setIsParsing(true);
    try {
      if (!onParseFile) return;
      const result = await onParseFile();
      if (result) {
        if (result.success) {
          setParseResult(JSON.stringify(result.result, null, 2));
        } else {
          setParseResult(`Error: ${result.error}`);
        }
      }
    } finally {
      setIsParsing(false);
    }
  };

  const handleResetOnboarding = () => {
    if (!confirm('Clear onboarding state? (This will show onboarding again only if no folders are configured.)')) {
      return;
    }
    clearOnboardingData();
    reloadApp();
  };

  const handleResetInitialization = async () => {
    if (!confirm('Clear initialization data? (This will remove all watched folders and refresh the app.)')) {
      return;
    }
    try {
      await clearInitializationData();
      reloadApp();
    } catch (error) {
      alert(`Failed to clear initialization data: ${String(error)}`);
    }
  };

  const handleFullReset = async () => {
    if (!confirm('Full reset? (Clears onboarding + watched folders, then reloads.)')) {
      return;
    }
    try {
      clearOnboardingData();
      await clearInitializationData();
      reloadApp();
    } catch (error) {
      alert(`Failed to reset: ${String(error)}`);
    }
  };

  const handleClearAllFolders = async () => {
    if (!confirm('Are you sure you want to remove all watched folders? This will clear all saved settings.')) {
      return;
    }
    try {
      const result = onClearAllFolders ? await onClearAllFolders() : { success: true as const };
      if (!onClearAllFolders) {
        await invoke('clear_all_watched_folders');
      }
      if (result.success) {
        alert('All watched folders cleared successfully!');
        reloadApp();
      } else {
        alert(`Failed to clear folders: ${result.error}`);
      }
    } catch (error) {
      alert(`Failed to clear folders: ${String(error)}`);
    }
  };

  useEffect(() => {
    const loadSystemInfo = async () => {
      try {
        const platform = await invoke<string>('plugin:os|platform');
        const version = await invoke<string>('plugin:os|version');
        const arch = await invoke<string>('plugin:os|arch');
        setSystemInfo({ platform, version, arch });
      } catch (err) {
        console.error('Failed to load system info:', err);
        // Fallback to navigator
        setSystemInfo({
          platform: navigator.platform,
          version: navigator.userAgent,
          arch: navigator.userAgent.includes('x64') ? 'x64' : 'unknown'
        });
      }
    };

    if (isOpen) {
      loadSystemInfo();
    }
  }, [isOpen]);

  return (
    <div className="bg-zinc-800 rounded-lg border border-zinc-700 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-3 flex items-center justify-between hover:bg-zinc-700 transition-colors"
      >
        <span className="font-semibold flex items-center gap-2">
          <FileCode className="w-4 h-4" />
          Debug Tools
        </span>
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="p-6 border-t border-zinc-700 dark:border-zinc-700">
          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b border-zinc-700 dark:border-zinc-700">
            <button
              onClick={() => setActiveTab('parse')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'parse'
                  ? 'text-white dark:text-white border-b-2 border-white dark:border-white'
                  : 'text-zinc-400 dark:text-zinc-400 hover:text-zinc-200 dark:hover:text-zinc-200'
              }`}
            >
              <FileCode className="w-4 h-4 inline-block mr-2" />
              Parser Test
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'system'
                  ? 'text-white dark:text-white border-b-2 border-white dark:border-white'
                  : 'text-zinc-400 dark:text-zinc-400 hover:text-zinc-200 dark:hover:text-zinc-200'
              }`}
            >
              <Info className="w-4 h-4 inline-block mr-2" />
              System Info
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'database'
                  ? 'text-white dark:text-white border-b-2 border-white dark:border-white'
                  : 'text-zinc-400 dark:text-zinc-400 hover:text-zinc-200 dark:hover:text-zinc-200'
              }`}
            >
              <Database className="w-4 h-4 inline-block mr-2" />
              Database
            </button>
          </div>

          {/* Parser Tab */}
          {activeTab === 'parse' && (
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={handleParseFile}
                  disabled={isParsing}
                  className="px-4 py-2 bg-zinc-700 dark:bg-zinc-700 hover:bg-zinc-600 dark:hover:bg-zinc-600 rounded-md transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isParsing ? 'Parsing...' : 'Test Parse File'}
                </button>
                <button
                  onClick={() => onRefresh?.()}
                  className="px-4 py-2 bg-zinc-700 dark:bg-zinc-700 hover:bg-zinc-600 dark:hover:bg-zinc-600 rounded-md transition-colors text-sm flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Data
                </button>
                <button
                  onClick={handleClearAllFolders}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 dark:text-red-400 rounded-md transition-colors text-sm flex items-center gap-2 border border-red-500/30 dark:border-red-500/30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All Folders
                </button>
              </div>

              {parseResult && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-zinc-400 dark:text-zinc-400 font-semibold">PARSE RESULT</span>
                    <button
                      onClick={() => setParseResult('')}
                      className="text-xs text-zinc-500 dark:text-zinc-500 hover:text-zinc-300 dark:hover:text-zinc-300"
                    >
                      Clear
                    </button>
                  </div>
                  <pre className="bg-zinc-900 dark:bg-zinc-900 p-4 rounded border border-zinc-700 dark:border-zinc-700 text-xs overflow-x-auto max-h-[300px] overflow-y-auto scrollbar-hide font-mono">
                    {parseResult}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* System Info Tab */}
          {activeTab === 'system' && (
            <div className="space-y-3">
              <div className="bg-zinc-900 dark:bg-zinc-900 p-4 rounded border border-zinc-700 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-zinc-300 dark:text-zinc-300 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Application Info
                </h3>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-500">Version:</dt>
                    <dd className="text-zinc-300 dark:text-zinc-300 font-mono">0.1.0</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-500">Platform:</dt>
                    <dd className="text-zinc-300 dark:text-zinc-300 font-mono">{systemInfo?.platform || 'Loading...'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-500">Architecture:</dt>
                    <dd className="text-zinc-300 dark:text-zinc-300 font-mono">{systemInfo?.arch || 'Loading...'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-500">OS Version:</dt>
                    <dd className="text-zinc-300 dark:text-zinc-300 font-mono text-right max-w-xs truncate">
                      {systemInfo?.version || 'Loading...'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-zinc-900 dark:bg-zinc-900 p-4 rounded border border-zinc-700 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-zinc-300 dark:text-zinc-300 mb-3">Parser Capabilities</h3>
                <ul className="space-y-1 text-xs text-zinc-400 dark:text-zinc-400">
                  <li>✅ Track parsing (Audio, MIDI, Return, Group, Master)</li>
                  <li>✅ Device detection (Native, VST, AU, Racks)</li>
                  <li>✅ Tempo & time signature extraction</li>
                  <li>✅ Sample reference tracking</li>
                  <li>✅ Project diffing & change detection</li>
                  <li>✅ Version support: Ableton Live 4-12</li>
                </ul>
              </div>
            </div>
          )}

          {/* Database Tab */}
          {activeTab === 'database' && (
            <div className="space-y-3">
              <div className="bg-zinc-900 dark:bg-zinc-900 p-4 rounded border border-zinc-700 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-zinc-300 dark:text-zinc-300 mb-3 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Reset / Undo (Debug)
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={handleResetOnboarding}
                    className="w-full px-4 py-2 bg-zinc-700 dark:bg-zinc-700 hover:bg-zinc-600 dark:hover:bg-zinc-600 rounded-md transition-colors text-sm text-left"
                  >
                    Clear onboarding data
                  </button>
                  <button
                    onClick={handleResetInitialization}
                    className="w-full px-4 py-2 bg-zinc-700 dark:bg-zinc-700 hover:bg-zinc-600 dark:hover:bg-zinc-600 rounded-md transition-colors text-sm text-left"
                  >
                    Clear initialization data (watched folders)
                  </button>
                  <button
                    onClick={handleFullReset}
                    className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 dark:text-red-400 rounded-md transition-colors text-sm text-left border border-red-500/30 dark:border-red-500/30"
                  >
                    Full reset (onboarding + init)
                  </button>
                </div>
              </div>

              <div className="bg-zinc-900 dark:bg-zinc-900 p-4 rounded border border-zinc-700 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-zinc-300 dark:text-zinc-300 mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Database Status
                </h3>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-500">Type:</dt>
                    <dd className="text-zinc-300 dark:text-zinc-300 font-mono">SQLite</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-500">Location:</dt>
                    <dd className="text-zinc-300 dark:text-zinc-300 font-mono text-xs">~/Library/Application Support/com.backtrack.app/</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-500">Status:</dt>
                    <dd className="text-green-400 dark:text-green-400 font-mono">Connected</dd>
                  </div>
                </dl>
              </div>

              <div className="bg-zinc-900 dark:bg-zinc-900 p-4 rounded border border-zinc-700 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-zinc-300 dark:text-zinc-300 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button className="w-full px-4 py-2 bg-zinc-700 dark:bg-zinc-700 hover:bg-zinc-600 dark:hover:bg-zinc-600 rounded-md transition-colors text-sm text-left">
                    Export database as JSON
                  </button>
                  <button className="w-full px-4 py-2 bg-zinc-700 dark:bg-zinc-700 hover:bg-zinc-600 dark:hover:bg-zinc-600 rounded-md transition-colors text-sm text-left">
                    View recent changes
                  </button>
                  <button className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 dark:text-red-400 rounded-md transition-colors text-sm text-left border border-red-500/30 dark:border-red-500/30">
                    Clear database (danger)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
