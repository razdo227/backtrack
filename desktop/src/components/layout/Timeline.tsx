
import type { ChangeEvent } from '../../types';

interface TimelineProps {
  changes: ChangeEvent[];
}

export function Timeline({ changes }: TimelineProps) {
  return (
    <div className="w-full bg-zinc-200/50 dark:bg-zinc-950/50 border-l border-zinc-300 dark:border-zinc-800 h-full flex flex-col">
      <div className="p-4 border-b border-zinc-300/50 dark:border-zinc-800/50">
        <h2 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 tracking-wider">TIMELINE</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="relative pl-2">
          {/* Vertical line - strictly strictly absolute to span the whole height */}
          <div className="absolute left-[7px] top-2 bottom-0 w-px bg-zinc-400 dark:bg-zinc-800" />

          {changes.map((change, index) => (
            <div key={index} className="relative mb-8 last:mb-0 pl-6 group">
              {/* Dot */}
              <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 z-10 ${
                index === 0
                  ? 'border-zinc-900 dark:border-white bg-zinc-900 dark:bg-white'
                  : 'border-zinc-500 dark:border-zinc-600 bg-zinc-200 dark:bg-zinc-950'
              }`}>
                {index === 0 && <div className="absolute inset-0 m-auto w-1.5 h-1.5 rounded-full bg-transparent" />}
              </div>

              {/* Content */}
              <div>
                <h3 className={`text-sm font-medium leading-tight mb-1 ${
                  index === 0
                    ? 'text-zinc-900 dark:text-white'
                    : 'text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-300'
                }`}>
                  {change.summary || 'Project Update'}
                </h3>
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-600 font-mono">
                  <span>
                    {new Date(change.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                  <span>•</span>
                  <span>#{change.file_hash?.substring(0, 6) || '8a2b4f'}</span>
                </div>
              </div>
            </div>
          ))}

          {changes.length === 0 && (
            <div className="pl-6 text-sm text-zinc-500 dark:text-zinc-600 italic">
              No history available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
