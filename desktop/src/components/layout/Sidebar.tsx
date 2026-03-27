import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Folder,
} from 'lucide-react';
import type { ProjectOverview } from '../../types';

interface SidebarProps {
  projects: string[];
  onAddFolder: () => void;
  selectedProjectPath?: string;
  onSelectProject: (projectPath: string) => void;
}

type ProjectsSort = 'name:asc' | 'name:desc' | 'modified:desc' | 'modified:asc';

const SIDEBAR_COLLAPSED_KEY = 'backtrack.sidebar.projects.collapsed';
const SIDEBAR_SORT_KEY = 'backtrack.sidebar.projects.sort';
const DEFAULT_SORT: ProjectsSort = 'modified:desc';

function readLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function isProjectsSort(value: string | null): value is ProjectsSort {
  return (
    value === 'name:asc' ||
    value === 'name:desc' ||
    value === 'modified:desc' ||
    value === 'modified:asc'
  );
}

export function Sidebar({
  projects,
  onAddFolder,
  selectedProjectPath,
  onSelectProject,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => readLocalStorage(SIDEBAR_COLLAPSED_KEY) === '1');
  const [sort, setSort] = useState<ProjectsSort>(() => {
    const stored = readLocalStorage(SIDEBAR_SORT_KEY);
    return isProjectsSort(stored) ? stored : DEFAULT_SORT;
  });
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const sortPopupRef = useRef<HTMLDivElement | null>(null);
  const [overviewByPath, setOverviewByPath] = useState<Record<string, ProjectOverview>>({});

  useLayoutEffect(() => {
    if (!isSortOpen) return;

    const wrapperEl = sortMenuRef.current;
    const popupEl = sortPopupRef.current;
    if (!wrapperEl || !popupEl) return;

    const VIEWPORT_PADDING_PX = 8;

    const positionPopup = () => {
      const popupWidth = popupEl.getBoundingClientRect().width;
      const wrapperRect = wrapperEl.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      const desiredLeft = wrapperRect.right - popupWidth;
      const minLeft = VIEWPORT_PADDING_PX;
      const maxLeft = Math.max(minLeft, viewportWidth - popupWidth - VIEWPORT_PADDING_PX);
      const clampedLeft = Math.min(Math.max(desiredLeft, minLeft), maxLeft);
      const localLeft = clampedLeft - wrapperRect.left;

      popupEl.style.left = `${localLeft}px`;
      popupEl.style.right = 'auto';
    };

    positionPopup();
    window.addEventListener('resize', positionPopup);
    return () => {
      window.removeEventListener('resize', positionPopup);
    };
  }, [isSortOpen]);

  useEffect(() => {
    writeLocalStorage(SIDEBAR_COLLAPSED_KEY, isCollapsed ? '1' : '0');
  }, [isCollapsed]);

  useEffect(() => {
    writeLocalStorage(SIDEBAR_SORT_KEY, sort);
  }, [sort]);

  useEffect(() => {
    if (!isSortOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && sortMenuRef.current && !sortMenuRef.current.contains(target)) {
        setIsSortOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSortOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isSortOpen]);

  useEffect(() => {
    let cancelled = false;

    const loadOverviews = async () => {
      if (projects.length === 0) {
        setOverviewByPath({});
        return;
      }

      try {
        const overviews = await invoke<ProjectOverview[]>('get_projects_overview', { paths: projects });
        if (cancelled) return;

        const next: Record<string, ProjectOverview> = {};
        for (const overview of overviews) {
          next[overview.path] = overview;
        }
        setOverviewByPath(next);
      } catch (error) {
        console.error('Failed to load project overviews:', error);
      }
    };

    loadOverviews();

    return () => {
      cancelled = true;
    };
  }, [projects]);

  const sortedProjects = useMemo(() => {
    const [key, dir] = sort.split(':') as ['name' | 'modified', 'asc' | 'desc'];

    const rows = projects.map((path) => {
      const overview = overviewByPath[path];
      return {
        path,
        name: overview?.name ?? basename(path),
        modifiedMs: overview?.dir_modified_ms ?? null,
      };
    });

    const nameCmp = (a: string, b: string) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

    rows.sort((a, b) => {
      if (key === 'modified') {
        const aMs = a.modifiedMs;
        const bMs = b.modifiedMs;

        if (aMs == null && bMs == null) {
          return nameCmp(a.name, b.name);
        }
        if (aMs == null) return 1;
        if (bMs == null) return -1;

        const diff = aMs - bMs;
        return dir === 'asc' ? diff : -diff;
      }

      const diff = nameCmp(a.name, b.name);
      return dir === 'asc' ? diff : -diff;
    });

    return rows;
  }, [projects, overviewByPath, sort]);

  return (
    <div
      className={`bg-zinc-100 dark:bg-zinc-950 flex flex-col border-r border-zinc-300 dark:border-zinc-800 h-full transition-[width] duration-200 ease-out ${
        isCollapsed ? 'w-12' : 'w-64'
      }`}
    >
      {isCollapsed ? (
        <div className="flex-1 flex items-start justify-center pt-2">
          <button
            onClick={() => setIsCollapsed(false)}
            className="h-9 w-9 rounded-md flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors"
            title="Expand projects"
            aria-label="Expand projects"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      ) : (
        <>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 tracking-wider">PROJECTS</h2>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-500">({projects.length})</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative" ref={sortMenuRef}>
                <button
                  onClick={() => setIsSortOpen((v) => !v)}
                  className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  title="Sort projects"
                  aria-label="Sort projects"
                >
                  <ArrowUpDown size={16} />
                </button>

                {isSortOpen && (
                  <div
                    ref={sortPopupRef}
                    className="absolute right-0 mt-2 w-[min(14rem,calc(100vw-16px))] bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md shadow-lg z-20 overflow-hidden"
                  >
                    <SortOption
                      isSelected={sort === 'name:asc'}
                      icon={<ArrowDownAZ size={14} />}
                      label="Name (A → Z)"
                      onSelect={() => setSort('name:asc')}
                      onClose={() => setIsSortOpen(false)}
                    />
                    <SortOption
                      isSelected={sort === 'name:desc'}
                      icon={<ArrowUpAZ size={14} />}
                      label="Name (Z → A)"
                      onSelect={() => setSort('name:desc')}
                      onClose={() => setIsSortOpen(false)}
                    />
                    <SortOption
                      isSelected={sort === 'modified:desc'}
                      icon={<Clock size={14} />}
                      label="Modified (Newest)"
                      onSelect={() => setSort('modified:desc')}
                      onClose={() => setIsSortOpen(false)}
                    />
                    <SortOption
                      isSelected={sort === 'modified:asc'}
                      icon={<Clock size={14} />}
                      label="Modified (Oldest)"
                      onSelect={() => setSort('modified:asc')}
                      onClose={() => setIsSortOpen(false)}
                    />
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setIsSortOpen(false);
                  setIsCollapsed(true);
                }}
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                title="Collapse projects"
                aria-label="Collapse projects"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <ul className="space-y-0.5 px-2">
              {sortedProjects.map(({ path, name }) => {
                const isSelected = path === selectedProjectPath;

                return (
                  <li key={path}>
                    <button
                      onClick={() => onSelectProject(path)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-all ${
                        isSelected
                          ? 'bg-zinc-300 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <Folder
                        size={16}
                        className={isSelected ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-500'}
                      />
                      <span className="truncate">{name}</span>
                    </button>
                  </li>
                );
              })}

              {projects.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-zinc-500 dark:text-zinc-600 text-sm mb-2">No projects yet</p>
                  <button
                    onClick={onAddFolder}
                    className="text-xs bg-zinc-300 dark:bg-zinc-800 hover:bg-zinc-400 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-300 px-3 py-1.5 rounded border border-zinc-400 dark:border-zinc-700 transition"
                  >
                    Add Project
                  </button>
                </div>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function SortOption({
  isSelected,
  icon,
  label,
  onSelect,
  onClose,
}: {
  isSelected: boolean;
  icon: ReactNode;
  label: string;
  onSelect: () => void;
  onClose: () => void;
}) {
  return (
    <button
      onClick={() => {
        onSelect();
        onClose();
      }}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
    >
      <span className="w-4 h-4 flex items-center justify-center text-zinc-500 dark:text-zinc-400">{icon}</span>
      <span className="flex-1 text-zinc-800 dark:text-zinc-200">{label}</span>
      {isSelected && <Check size={14} className="text-zinc-700 dark:text-zinc-300" />}
    </button>
  );
}
