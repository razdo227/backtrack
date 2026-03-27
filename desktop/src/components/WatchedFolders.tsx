import { FolderOpen, Plus, X } from 'lucide-react';

interface WatchedFoldersProps {
  folders: string[];
  onAdd: () => void;
  onRemove: (folder: string) => void;
  isLoading: boolean;
}

export default function WatchedFolders({
  folders,
  onAdd,
  onRemove,
  isLoading,
}: WatchedFoldersProps) {
  return (
    <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FolderOpen className="w-5 h-5" />
          Watched Folders
        </h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover rounded-md transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Folder
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-zinc-400">Loading...</div>
      ) : folders.length === 0 ? (
        <div className="text-center py-8 text-zinc-400 italic">
          No folders being watched. Click "Add Folder" to start.
        </div>
      ) : (
        <div className="space-y-2">
          {folders.map((folder) => (
            <div
              key={folder}
              className="flex items-center justify-between p-3 bg-zinc-900 rounded border border-zinc-700 hover:border-zinc-600 transition-colors"
            >
              <span className="font-mono text-sm text-zinc-300 truncate flex-1">
                {folder}
              </span>
              <button
                onClick={() => onRemove(folder)}
                className="ml-3 p-1 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 transition-colors"
                title="Remove folder"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
