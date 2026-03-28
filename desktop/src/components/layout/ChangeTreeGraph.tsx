import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Minus,
  Pencil,
  Music2,
  Cpu,
  HardDrive,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import type { ChangeEvent, ProjectDiff, TrackModification, MasterChange, Device } from '../../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function shortHash(hash?: string): string {
  return hash ? hash.slice(0, 7) : '·······';
}

/** Dominant colour of a commit node based on what changed. */
function nodeColor(diff?: ProjectDiff): string {
  if (!diff) return 'bg-zinc-700 border-zinc-600';
  const adds = diff.tracks_added.length + diff.master_changes.filter(isMasterAdded).length;
  const dels = diff.tracks_removed.length + diff.master_changes.filter(isMasterRemoved).length;
  const mods = diff.tracks_modified.length;
  if (adds > 0 && dels === 0 && mods === 0) return 'bg-emerald-500 border-emerald-400';
  if (dels > 0 && adds === 0 && mods === 0) return 'bg-red-500 border-red-400';
  if (mods > 0 && adds === 0 && dels === 0) return 'bg-amber-500 border-amber-400';
  if (adds > 0 || dels > 0 || mods > 0) return 'bg-indigo-500 border-indigo-400';
  return 'bg-zinc-700 border-zinc-600';
}

function lineColor(diff?: ProjectDiff): string {
  if (!diff) return 'bg-zinc-800';
  const adds = diff.tracks_added.length;
  const dels = diff.tracks_removed.length;
  const mods = diff.tracks_modified.length;
  if (adds > 0 && dels === 0 && mods === 0) return 'bg-emerald-900/50';
  if (dels > 0 && adds === 0 && mods === 0) return 'bg-red-900/50';
  if (adds > 0 || dels > 0 || mods > 0) return 'bg-indigo-900/50';
  return 'bg-zinc-800';
}

function isMasterAdded(c: MasterChange): boolean {
  return 'DeviceAdded' in c;
}
function isMasterRemoved(c: MasterChange): boolean {
  return 'DeviceRemoved' in c;
}

function deviceLabel(d: Device): string {
  return d.name || d.device_type;
}

// ─── Diff Tree sub-components ────────────────────────────────────────────────

function DiffRow({
  icon,
  label,
  colour,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  colour: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <div className={`flex items-center gap-1.5 text-[11px] font-medium ${colour}`}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      {sub && <div className="ml-4 space-y-0.5">{sub}</div>}
    </div>
  );
}

function DeviceChip({ label, colour }: { label: string; colour: string }) {
  return (
    <div className={`flex items-center gap-1 text-[10px] ${colour}`}>
      <Cpu size={9} className="shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function DiffTree({ diff }: { diff: ProjectDiff }) {
  const hasContent =
    diff.tracks_added.length > 0 ||
    diff.tracks_removed.length > 0 ||
    diff.tracks_modified.length > 0 ||
    diff.master_changes.length > 0;

  if (!hasContent) {
    return <p className="text-[10px] text-zinc-600 italic">No structural changes recorded</p>;
  }

  return (
    <div className="space-y-1.5">
      {/* Added tracks */}
      {diff.tracks_added.map((t, i) => (
        <DiffRow
          key={`add-${i}`}
          icon={<Plus size={10} className="shrink-0" />}
          label={t.name || `Track ${i + 1}`}
          colour="text-emerald-400"
          sub={
            t.devices.length > 0 ? (
              <>
                {t.devices.map((d, di) => (
                  <DeviceChip key={di} label={deviceLabel(d)} colour="text-emerald-600" />
                ))}
              </>
            ) : undefined
          }
        />
      ))}

      {/* Removed tracks */}
      {diff.tracks_removed.map((t, i) => (
        <DiffRow
          key={`rem-${i}`}
          icon={<Minus size={10} className="shrink-0" />}
          label={t.name || `Track ${i + 1}`}
          colour="text-red-400"
          sub={
            t.devices.length > 0 ? (
              <>
                {t.devices.map((d, di) => (
                  <DeviceChip key={di} label={deviceLabel(d)} colour="text-red-600" />
                ))}
              </>
            ) : undefined
          }
        />
      ))}

      {/* Modified tracks */}
      {diff.tracks_modified.map((mod: TrackModification, i) => {
        const nameLabel = mod.name_changed
          ? `${mod.old_name} → ${mod.new_name}`
          : mod.new_name || mod.old_name;
        return (
          <DiffRow
            key={`mod-${i}`}
            icon={<Pencil size={10} className="shrink-0" />}
            label={nameLabel}
            colour="text-amber-400"
            sub={
              (mod.devices_added.length > 0 || mod.devices_removed.length > 0 || mod.color_changed) ? (
                <>
                  {mod.color_changed && (
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <span>Color changed</span>
                    </div>
                  )}
                  {mod.devices_added.map((d, di) => (
                    <DeviceChip key={`da-${di}`} label={`+ ${deviceLabel(d)}`} colour="text-emerald-600" />
                  ))}
                  {mod.devices_removed.map((d, di) => (
                    <DeviceChip key={`dr-${di}`} label={`- ${deviceLabel(d)}`} colour="text-red-600" />
                  ))}
                </>
              ) : undefined
            }
          />
        );
      })}

      {/* Master changes */}
      {diff.master_changes.length > 0 && (
        <DiffRow
          icon={<Music2 size={10} className="shrink-0" />}
          label="Master"
          colour="text-indigo-400"
          sub={
            <>
              {diff.master_changes.map((c, i) => {
                if ('DeviceAdded' in c) {
                  return <DeviceChip key={i} label={`+ ${deviceLabel(c.DeviceAdded)}`} colour="text-emerald-600" />;
                }
                return <DeviceChip key={i} label={`- ${deviceLabel(c.DeviceRemoved)}`} colour="text-red-600" />;
              })}
            </>
          }
        />
      )}
    </div>
  );
}

// ─── Single commit row ────────────────────────────────────────────────────────

function CommitRow({
  change,
  index,
  isLast,
}: {
  change: ChangeEvent;
  index: number;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const dot = nodeColor(change.diff);
  const connector = lineColor(change.diff);

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.035, 0.4) }}
      className="relative flex gap-3 pb-0"
    >
      {/* Spine */}
      <div className="relative flex flex-col items-center shrink-0" style={{ width: 14 }}>
        <div className={`w-[7px] h-[7px] rounded-full border mt-[3px] shrink-0 z-10 ${dot}`} />
        {!isLast && (
          <div className={`flex-1 w-px mt-0.5 min-h-[32px] ${connector}`} />
        )}
      </div>

      {/* Card */}
      <div className="flex-1 pb-3 min-w-0">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-left group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-zinc-300 leading-snug truncate group-hover:text-white transition-colors">
                {change.summary || change.diff_summary || 'No changes'}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[10px] text-zinc-600 font-mono">{shortHash(change.file_hash)}</span>
                <span className="text-[10px] text-zinc-600">·</span>
                <span className="text-[10px] text-zinc-500">{relativeTime(change.timestamp)}</span>
                {change.diff && (
                  <>
                    {change.diff.tracks_added.length > 0 && (
                      <span className="text-[10px] text-emerald-500 font-medium">+{change.diff.tracks_added.length}</span>
                    )}
                    {change.diff.tracks_removed.length > 0 && (
                      <span className="text-[10px] text-red-400 font-medium">-{change.diff.tracks_removed.length}</span>
                    )}
                    {change.diff.tracks_modified.length > 0 && (
                      <span className="text-[10px] text-amber-400 font-medium">~{change.diff.tracks_modified.length}</span>
                    )}
                  </>
                )}
              </div>
            </div>
            {change.diff && (
              <div className="shrink-0 mt-0.5 text-zinc-700 group-hover:text-zinc-500 transition-colors">
                {expanded
                  ? <ChevronDown size={11} />
                  : <ChevronRight size={11} />}
              </div>
            )}
          </div>
        </button>

        {/* Expandable diff tree */}
        <AnimatePresence>
          {expanded && change.diff && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="mt-2 pt-2 border-t border-zinc-800/60">
                <DiffTree diff={change.diff} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Initial snapshot (no diff) */}
        {expanded && !change.diff && change.diff_summary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-1.5 text-[10px] text-zinc-500 italic"
          >
            {change.diff_summary}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

interface ChangeTreeGraphProps {
  projectPath?: string;
  /** Live changes from the in-memory watcher (newest first). Merged with DB history. */
  liveChanges?: ChangeEvent[];
}

export function ChangeTreeGraph({ projectPath, liveChanges = [] }: ChangeTreeGraphProps) {
  const [history, setHistory] = useState<ChangeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!projectPath) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<ChangeEvent[]>('get_project_history', {
        projectPath,
        limit: 100,
      });
      setHistory(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    setHistory([]);
    loadHistory();
  }, [projectPath, loadHistory]);

  // Merge live changes on top of persisted history, deduplicating by file_hash
  const merged: ChangeEvent[] = (() => {
    const seen = new Set<string>();
    const all: ChangeEvent[] = [];
    for (const c of [...liveChanges, ...history]) {
      const key = c.file_hash ?? c.timestamp;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(c);
      }
    }
    // Sort newest first
    all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return all;
  })();

  // ── Empty / loading states ──────────────────────────────────────────────────
  if (!projectPath) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-zinc-700 px-4 text-center">
        <HardDrive size={22} className="mb-2 opacity-40" />
        <p className="text-xs">Select a project to see its history</p>
      </div>
    );
  }

  if (loading && merged.length === 0) {
    return (
      <div className="flex items-center justify-center h-20">
        <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-indigo-500/40 border-t-indigo-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 flex flex-col items-center gap-2 text-center">
        <AlertCircle size={18} className="text-red-500/70" />
        <p className="text-[11px] text-zinc-500">Failed to load history</p>
        <button
          onClick={loadHistory}
          className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition"
        >
          <RefreshCw size={10} /> Retry
        </button>
      </div>
    );
  }

  if (merged.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-zinc-700 px-4 text-center">
        <HardDrive size={22} className="mb-2 opacity-40" />
        <p className="text-xs">No snapshots yet</p>
        <p className="text-[10px] mt-1 text-zinc-700">Backtrack captures changes as you save in Ableton</p>
      </div>
    );
  }

  return (
    <div className="px-3 pt-3 pb-4">
      {/* Refresh button */}
      <div className="flex justify-end mb-2">
        <button
          onClick={loadHistory}
          disabled={loading}
          className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition disabled:opacity-40"
          title="Refresh history"
        >
          <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div>
        {merged.map((change, i) => (
          <CommitRow
            key={change.file_hash ?? change.timestamp}
            change={change}
            index={i}
            isLast={i === merged.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
