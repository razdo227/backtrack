import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import type {
  ChangeEvent,
  FileParsedEvent,
  ParseErrorEvent,
  FileChangedEvent,
  AbletonProject,
} from '../types';

interface InitProjectsResult {
  created: number;
  already_initialized: number;
  failed: Array<{ path: string; error: string }>;
}

export function useTauri() {
  const [watchedFolders, setWatchedFolders] = useState<string[]>([]);
  const [recentChanges, setRecentChanges] = useState<ChangeEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scannedProjects, setScannedProjects] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const mergeScannedProjects = useCallback((projects: string[]) => {
    setScannedProjects((prev) => {
      const unique = new Set([...prev, ...projects]);
      return Array.from(unique).sort();
    });
  }, []);

  const scanFolder = useCallback(
    async (path: string) => {
      setIsScanning(true);
      try {
        const projects = await invoke<string[]>('scan_for_projects', { path });
        mergeScannedProjects(projects);

        try {
          await invoke<InitProjectsResult>('initialize_projects', { projectPaths: projects });
        } catch (error) {
          console.error('Project initialization failed:', error);
        }

        return projects;
      } catch (error) {
        console.error('Scan failed:', error);
        return [];
      } finally {
        setIsScanning(false);
      }
    },
    [mergeScannedProjects],
  );

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [folders, changes] = await Promise.all([
        invoke<string[]>('get_watched_folders'),
        invoke<ChangeEvent[]>('get_recent_changes'),
      ]);
      setWatchedFolders(folders);
      setRecentChanges(changes);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add watched folder
  const addFolder = useCallback(async () => {
    try {
      console.log('Opening folder dialog...');
      const folder = await open({
        directory: true,
        multiple: false,
        title: 'Select Ableton Projects Folder',
      });

      console.log('Dialog result:', folder);

      if (!folder) {
        console.log('No folder selected (user cancelled)');
        return { success: false, error: 'No folder selected' };
      }

      console.log('Adding watched folder:', folder);
      await invoke('add_watched_folder', { folder });
      setWatchedFolders((prev) => [...prev, folder]);

      // Automatically scan for projects in the added folder
      console.log('Scanning for projects in:', folder);
      try {
        const projects = await scanFolder(folder);
        console.log('Found projects:', projects);
      } catch (scanError) {
        console.error('Failed to scan for projects:', scanError);
      }

      return { success: true, folder };
    } catch (error) {
      console.error('Failed to add folder:', error);
      return { success: false, error: String(error) };
    }
  }, []);

  // Remove watched folder
  const removeFolder = useCallback(async (folder: string) => {
    try {
      await invoke('remove_watched_folder', { folder });
      setWatchedFolders((prev) => prev.filter((f) => f !== folder));
      return { success: true };
    } catch (error) {
      console.error('Failed to remove folder:', error);
      return { success: false, error: String(error) };
    }
  }, []);

  // Parse file manually
  const parseFile = useCallback(async () => {
    try {
      const file = await open({
        filters: [
          {
            name: 'Ableton Project',
            extensions: ['als'],
          },
        ],
        title: 'Select .als file to parse',
      });

      if (!file) return null;

      const result = await invoke<AbletonProject>('parse_file_now', { path: file });
      return { success: true, result };
    } catch (error) {
      console.error('Failed to parse file:', error);
      return { success: false, error: String(error) };
    }
  }, []);

  // Clear recent changes
  const clearChanges = useCallback(async () => {
    try {
      await invoke('clear_recent_changes');
      setRecentChanges([]);
      return { success: true };
    } catch (error) {
      console.error('Failed to clear changes:', error);
      return { success: false, error: String(error) };
    }
  }, []);

  // Setup event listeners
  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const setupListeners = async () => {
      // Settings loaded event - refresh data when settings are loaded
      const unlisten0 = await listen('settings-loaded', async () => {
        console.log('Settings loaded, refreshing data...');
        await loadData();

        // Scan all watched folders for projects
        try {
          const folders = await invoke<string[]>('get_watched_folders');
          setIsScanning(true);
          for (const folder of folders) {
            console.log('Scanning loaded folder:', folder);
            const projects = await invoke<string[]>('scan_for_projects', { path: folder });
            console.log('Found projects in', folder, ':', projects);
            mergeScannedProjects(projects);
          }
        } catch (error) {
          console.error('Failed to scan folders on load:', error);
        } finally {
          setIsScanning(false);
        }
      });
      unlisteners.push(unlisten0);

      // File parsed event
      const unlisten1 = await listen<FileParsedEvent>('file-parsed', (event) => {
        console.log('File parsed:', event.payload);
        setRecentChanges((prev) => [event.payload.change, ...prev.slice(0, 49)]);
      });
      unlisteners.push(unlisten1);

      // Parse error event
      const unlisten2 = await listen<ParseErrorEvent>('parse-error', (event) => {
        console.error('Parse error:', event.payload);
      });
      unlisteners.push(unlisten2);

      // File changed event
      const unlisten3 = await listen<FileChangedEvent>('file-changed', (event) => {
        console.log('File changed:', event.payload);
      });
      unlisteners.push(unlisten3);

      // Watcher error event
      const unlisten4 = await listen('watcher-error', (event) => {
        console.error('Watcher error:', event.payload);
      });
      unlisteners.push(unlisten4);
    };

    setupListeners();

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [loadData, mergeScannedProjects]);

  // Clear all watched folders
  const clearAllFolders = useCallback(async () => {
    try {
      await invoke('clear_all_watched_folders');
      setWatchedFolders([]);
      return { success: true };
    } catch (error) {
      console.error('Failed to clear all folders:', error);
      return { success: false, error: String(error) };
    }
  }, []);

  // Load data on mount - with a small delay to avoid race with settings loading
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadData]);

  return {
    watchedFolders,
    recentChanges,
    isLoading,
    scannedProjects, // New
    isScanning,      // New
    addFolder,
    removeFolder,
    clearAllFolders,
    parseFile,
    clearChanges,
    refresh: loadData,
    scanForProjects: scanFolder, // New
  };
}
