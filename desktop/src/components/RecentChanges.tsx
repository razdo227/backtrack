import { Clock, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ChangeEvent } from '../types';

interface RecentChangesProps {
  changes: ChangeEvent[];
  onClear: () => void;
  isLoading: boolean;
}

export default function RecentChanges({
  changes,
  onClear,
  isLoading,
}: RecentChangesProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Recent Changes
        </h2>
        {changes.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-md transition-colors text-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-zinc-400">Loading...</div>
      ) : changes.length === 0 ? (
        <div className="text-center py-8 text-zinc-400 italic">
          No changes detected yet.
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide">
          {changes.map((change, index) => {
            const isExpanded = expandedIndex === index;
            const hasDiff = !!change.diff_summary;

            return (
              <div
                key={`${change.file_path}-${index}`}
                className="bg-zinc-900 rounded border-l-4 border-primary"
              >
                <div
                  className={`p-4 ${hasDiff ? 'cursor-pointer hover:bg-zinc-800/50' : ''}`}
                  onClick={() => hasDiff && toggleExpand(index)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {hasDiff && (
                        <div className="text-zinc-500">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </div>
                      )}
                      <span className="font-semibold text-sm">{change.file_name}</span>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {formatTime(change.timestamp)}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-400 mb-1">{change.summary}</div>
                  <div className="text-xs text-zinc-600 font-mono truncate">
                    {change.file_path}
                  </div>
                </div>

                {/* Expandable diff section */}
                {hasDiff && isExpanded && (
                  <div className="px-4 pb-4 border-t border-zinc-800">
                    <pre className="text-xs text-zinc-300 mt-3 whitespace-pre-wrap font-mono leading-relaxed">
                      {change.diff_summary}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
