import { Plus, Minus, ChevronDown, PlusCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

// Mock types for now, will replace with real types
interface DetectedChange {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  name: string;
}

interface MainContentProps {
  projectTitle: string;
  projectPath?: string;
  version?: string;
  changes?: DetectedChange[];
  onCommit: (summary: string, desc: string) => void;
}

interface ProjectMetadata {
  last_modified: string;
  ableton_version: string | null;
  available_versions: string[];
}

export function MainContent({ projectTitle, projectPath, version = "main", changes = [], onCommit }: MainContentProps) {
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(version);
  const [metadata, setMetadata] = useState<ProjectMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // Load metadata when project changes
  useEffect(() => {
    const loadMetadata = async () => {
      if (!projectPath) return;

      setIsLoadingMetadata(true);
      try {
        const data = await invoke<ProjectMetadata>('get_project_metadata', {
          projectPath: projectPath
        });
        setMetadata(data);
        // Set selected version to the first available version
        if (data.available_versions.length > 0) {
          setSelectedVersion(data.available_versions[0]);
        }
      } catch (error) {
        console.error('Failed to load project metadata:', error);
      } finally {
        setIsLoadingMetadata(false);
      }
    };

    loadMetadata();
  }, [projectPath]);

  const handleCreateNewVersion = () => {
    const newVersionNumber = parseFloat(selectedVersion.replace('v', '')) + 0.1;
    const newVersion = `v${newVersionNumber.toFixed(1)}`;
    setSelectedVersion(newVersion);
    setIsVersionDropdownOpen(false);
    console.log(`Creating new version: ${newVersion}`);
    // TODO: Call backend to create new version
  };

  return (
    <div className="flex-1 bg-white dark:bg-zinc-900 flex flex-col min-w-0">
      {/* Header */}
      <div className="px-8 py-6 pb-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white uppercase tracking-tight">{projectTitle}</h1>

        {/* Metadata Column */}
        <div className="flex flex-col gap-2 text-sm mt-4">
          {/* Last Modified */}
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 dark:text-zinc-500 w-32">Last modified:</span>
            <span className="text-zinc-700 dark:text-zinc-300 font-medium">
              {isLoadingMetadata ? 'Loading...' : (metadata?.last_modified || 'Unknown')}
            </span>
          </div>

          {/* Ableton Version */}
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 dark:text-zinc-500 w-32">DAW Version:</span>
            <span className="text-zinc-700 dark:text-zinc-300 font-medium">
              {isLoadingMetadata ? 'Loading...' : (metadata?.ableton_version || 'Unknown')}
            </span>
          </div>

          {/* Project Version Dropdown */}
          <div className="flex items-center gap-2 relative">
            <span className="text-zinc-500 dark:text-zinc-500 w-32">Project version:</span>
            <button
              onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
              disabled={isLoadingMetadata}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-zinc-900 dark:text-white font-medium">{selectedVersion}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isVersionDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isVersionDropdownOpen && metadata && (
              <div className="absolute top-full mt-1 left-32 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md shadow-lg z-10 min-w-[200px]">
                <div className="py-1">
                  {/* Create New Version */}
                  <button
                    onClick={handleCreateNewVersion}
                    className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-700"
                  >
                    <PlusCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
                    <span className="font-medium">Create New Version</span>
                  </button>

                  {/* Existing Versions */}
                  {metadata.available_versions.length > 0 ? (
                    metadata.available_versions.map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          setSelectedVersion(v);
                          setIsVersionDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${
                          v === selectedVersion
                            ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white font-medium'
                            : 'text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {v}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-500 italic">
                      No versions found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-4 flex-1 overflow-y-auto">
        {/* Detected Changes Section */}
        <div className="mb-8">
          <h2 className="text-xs font-bold text-zinc-600 dark:text-zinc-500 uppercase tracking-wider mb-4">DETECTED CHANGES</h2>
          {changes.length > 0 ? (
            <div className="space-y-2">
              {changes.map((change, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800/50 transition-colors group">
                  {/* Icon Box */}
                  <div className="w-6 h-6 rounded flex items-center justify-center border border-zinc-400 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 group-hover:border-zinc-500 dark:group-hover:border-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors shrink-0">
                     {change.type === 'added' && <Plus size={14} />}
                     {change.type === 'modified' && <div className="w-2 h-2 rounded-full bg-current" />}
                     {change.type === 'deleted' && <Minus size={14} />}
                  </div>

                  <span className="text-zinc-800 dark:text-zinc-300 font-medium truncate">{change.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-zinc-500 dark:text-zinc-600 text-sm">No changes detected yet</p>
              <p className="text-zinc-600 dark:text-zinc-700 text-xs mt-1">Make changes to your project and save to see them here</p>
            </div>
          )}
        </div>

        {/* Commit Form */}
        <div className="mt-8 bg-zinc-200/50 dark:bg-zinc-950/30 rounded-lg p-1">
           <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-zinc-400 dark:focus-within:ring-zinc-700 transition-all">
             <input
               type="text"
               className="w-full bg-transparent border-b border-zinc-300 dark:border-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-600 focus:outline-none"
               placeholder="Summary (What did you change?)"
               value={summary}
               onChange={e => setSummary(e.target.value)}
             />
             <textarea
               className="w-full bg-transparent px-4 py-3 text-sm text-zinc-800 dark:text-zinc-300 placeholder:text-zinc-500 dark:placeholder:text-zinc-600 focus:outline-none resize-none h-24"
               placeholder="Description (optional)"
               value={description}
               onChange={e => setDescription(e.target.value)}
             />
           </div>

           <button
             onClick={() => onCommit(summary, description)}
             className="w-full mt-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold text-sm py-3 px-4 rounded hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-lg shadow-zinc-400/30 dark:shadow-zinc-950/50 uppercase tracking-wide"
           >
             Backtrack Current State
           </button>
        </div>
      </div>
    </div>
  );
}
