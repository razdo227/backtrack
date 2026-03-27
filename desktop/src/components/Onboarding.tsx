import { SignIn, useUser } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Folder, Sparkles } from 'lucide-react';

type OnboardingPage = 1 | 2 | 3 | 4;

interface OnboardingProps {
  watchedFolders: string[];
  scannedProjectsCount: number;
  isScanning: boolean;
  onAddFolder: () => Promise<{ success: boolean; folder?: string; error?: string }>;
  onComplete: () => void;
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export function Onboarding({
  watchedFolders,
  scannedProjectsCount,
  isScanning,
  onAddFolder,
  onComplete,
}: OnboardingProps) {
  const { isLoaded, isSignedIn } = useUser();
  const [page, setPage] = useState<OnboardingPage | null>(null);
  const [addFolderBusy, setAddFolderBusy] = useState(false);
  const [lastAddedFolder, setLastAddedFolder] = useState<string | undefined>(undefined);

  const canFinish = watchedFolders.length > 0;
  const primaryFolderLabel = useMemo(() => {
    const folder = lastAddedFolder ?? watchedFolders[0];
    return folder ? basename(folder) : 'No folder selected';
  }, [lastAddedFolder, watchedFolders]);

  useEffect(() => {
    if (!isLoaded) return;
    setPage(isSignedIn ? 1 : null);
  }, [isLoaded, isSignedIn]);

  const handleAddFolder = async () => {
    setAddFolderBusy(true);
    try {
      const result = await onAddFolder();
      if (result.success && result.folder) setLastAddedFolder(result.folder);
    } finally {
      setAddFolderBusy(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 z-[1000] bg-white dark:bg-zinc-950 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="fixed inset-0 z-[1000] bg-white dark:bg-zinc-950 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-white">Backtrack</div>
          </div>

          <SignIn />
        </div>
      </div>
    );
  }

  if (!page) return null;

  const backDisabled = page === 1 || addFolderBusy || isScanning;
  const nextDisabled = addFolderBusy || isScanning;
  const onBack = () => setPage((p) => (p && p > 1 ? ((p - 1) as OnboardingPage) : p));
  const onNext = () => setPage((p) => (p && p < 4 ? ((p + 1) as OnboardingPage) : p));

  return (
    <div className="fixed inset-0 z-[1000] bg-white dark:bg-zinc-950 flex flex-col">
      <div className="h-14 px-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-900 dark:text-white">Backtrack</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500">Welcome • {page} of 4</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 w-10 rounded-full ${
                s <= page ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-200 dark:bg-zinc-800'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-10 flex items-center justify-center">
        <div className="w-full max-w-xl">
          {page === 1 && (
            <>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white leading-tight">Welcome to Backtrack</h1>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                Backtrack helps you capture and review changes across Ableton projects.
              </p>
            </>
          )}

          {page === 2 && (
            <>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white leading-tight">Automatic tracking</h1>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                Watch your projects folder and Backtrack will build a timeline as you work.
              </p>
            </>
          )}

          {page === 3 && (
            <>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white leading-tight">Stay organized</h1>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                See what changed, when it changed, and quickly jump between project versions.
              </p>
            </>
          )}

          {page === 4 && (
            <>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white leading-tight">
                Select your master Ableton folder
              </h1>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                Select the parent folder that contains your Ableton project folders.
              </p>

              <div className="mt-6 rounded-lg border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-zinc-200 dark:bg-zinc-950 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                    <Folder size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{primaryFolderLabel}</div>
                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-500">
                      {isScanning ? (
                        <span className="inline-flex items-center gap-2">
                          <Spinner /> Scanning projects…
                        </span>
                      ) : watchedFolders.length > 0 ? (
                        <span>
                          Watching {watchedFolders.length} folder{watchedFolders.length === 1 ? '' : 's'} • Found{' '}
                          {scannedProjectsCount} project{scannedProjectsCount === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <span>No folder selected yet</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-6 py-5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          disabled={backDisabled}
          className="h-10 px-4 rounded-md text-sm font-semibold border border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Back
        </button>

        {page < 4 && (
          <button
            onClick={onNext}
            disabled={nextDisabled}
            className="h-10 px-4 rounded-md text-sm font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Next
          </button>
        )}

        {page === 4 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddFolder}
              disabled={addFolderBusy || isScanning}
              className="h-10 px-4 rounded-md text-sm font-semibold border border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {addFolderBusy || isScanning ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Selecting…
                </span>
              ) : (
                'Select Folder'
              )}
            </button>

            <button
              onClick={onComplete}
              disabled={!canFinish || isScanning}
              className="h-10 px-4 rounded-md text-sm font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
              title={!canFinish ? 'Select a folder first' : undefined}
            >
              Finish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 rounded-full border-2 border-zinc-400 dark:border-zinc-600 border-t-transparent animate-spin" />
  );
}
