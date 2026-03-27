import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, FileSearch, Clock, GitCommit, HardDrive, ChevronDown } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export interface SnapshotEntry {
  id: string;
  timestamp: string;
  filesChanged: number;
  sizeDelta: number; // bytes, positive = grew, negative = shrank
  label?: string;
  fileHash?: string;
}

interface SnapshotTimelineProps {
  projectPath?: string;
  snapshots: SnapshotEntry[];
  onRestore?: (snapshotId: string) => void;
}

function formatBytes(bytes: number): string {
  const abs = Math.abs(bytes);
  if (abs < 1024) return `${bytes > 0 ? '+' : ''}${bytes}B`;
  if (abs < 1024 * 1024) return `${bytes > 0 ? '+' : ''}${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes > 0 ? '+' : ''}${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatTimestamp(ts: string): { date: string; time: string } {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) return { date: 'Today', time };
  if (isYesterday) return { date: 'Yesterday', time };
  return { date: d.toLocaleDateString([], { month: 'short', day: 'numeric' }), time };
}

function SnapshotRow({
  snapshot,
  index,
  isFirst,
  onRestore,
}: {
  snapshot: SnapshotEntry;
  index: number;
  isFirst: boolean;
  onRestore: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const { date, time } = formatTimestamp(snapshot.timestamp);

  const handleRestore = async () => {
    if (!confirm(`Restore snapshot from ${date} at ${time}? This will overwrite current project files.`)) return;
    setRestoring(true);
    try {
      await onRestore(snapshot.id);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="relative pl-6 pb-5 last:pb-0 group"
    >
      {/* Timeline line */}
      {!isFirst && (
        <div className="absolute left-[7px] -top-2 h-4 w-px bg-zinc-800" />
      )}
      <div className="absolute left-[4px] top-1.5 w-[7px] h-[7px] rounded-full border z-10 transition-colors
        border-zinc-700 bg-zinc-900
        group-hover:border-indigo-500 group-hover:bg-indigo-900/40
        " />
      <div className="absolute left-[7px] top-3.5 bottom-0 w-px bg-zinc-800/70 last:hidden" />

      {/* Card */}
      <div
        className="bg-zinc-900/50 hover:bg-zinc-800/50 border border-zinc-800/80 rounded-lg px-3 py-2.5 transition-colors cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Clock size={10} />
              <span className="font-medium text-zinc-400">{date}</span>
              <span>·</span>
              <span>{time}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-400 flex items-center gap-1">
                <GitCommit size={10} />
                {snapshot.filesChanged} file{snapshot.filesChanged !== 1 ? 's' : ''} changed
              </span>
              {snapshot.sizeDelta !== 0 && (
                <span className={`text-xs font-mono ${snapshot.sizeDelta > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                  {formatBytes(snapshot.sizeDelta)}
                </span>
              )}
            </div>
            {snapshot.label && (
              <div className="mt-1 text-xs text-zinc-300 font-medium">{snapshot.label}</div>
            )}
          </div>
          <ChevronDown
            size={12}
            className={`text-zinc-600 shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleRestore(); }}
                  disabled={restoring}
                  className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md text-xs font-medium bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-900/60 transition disabled:opacity-50"
                >
                  <RotateCcw size={11} />
                  {restoring ? 'Restoring…' : 'Restore'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); }}
                  className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md text-xs font-medium bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-300 border border-zinc-700/60 transition"
                >
                  <FileSearch size={11} />
                  View Diff
                </button>
              </div>
              {snapshot.fileHash && (
                <div className="mt-1.5 text-[10px] text-zinc-700 font-mono">
                  #{snapshot.fileHash.slice(0, 12)}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function SnapshotTimeline({ projectPath, snapshots, onRestore }: SnapshotTimelineProps) {
  const handleRestore = async (id: string) => {
    if (onRestore) {
      onRestore(id);
      return;
    }
    // Default: invoke Tauri command
    try {
      await invoke('restore_snapshot', { snapshotId: id, projectPath });
    } catch (e) {
      alert(`Restore failed: ${e}`);
    }
  };

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-zinc-600">
        <HardDrive size={24} className="mb-2 opacity-40" />
        <p className="text-sm">No snapshots yet</p>
        <p className="text-xs mt-1 text-zinc-700">Backtrack will capture them as you work</p>
      </div>
    );
  }

  return (
    <div className="relative px-3 py-4">
      {snapshots.map((snap, i) => (
        <SnapshotRow
          key={snap.id}
          snapshot={snap}
          index={i}
          isFirst={i === 0}
          onRestore={handleRestore}
        />
      ))}
    </div>
  );
}
