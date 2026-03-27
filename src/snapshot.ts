import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SnapshotDiff, SnapshotFile, SnapshotManifest } from './types.js';

const DEFAULT_IGNORES = new Set(['.git', 'node_modules', 'dist', '.DS_Store']);

export interface CreateSnapshotOptions {
  ignore?: string[];
  includeExtensions?: string[];
}

async function readIgnoreFile(root: string): Promise<string[]> {
  const ignoreFile = path.join(root, '.backtrackignore');

  try {
    const raw = await fs.readFile(ignoreFile, 'utf8');
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function shouldIgnore(relativePath: string, ignoreEntries: string[]): boolean {
  const normalizedPath = relativePath.split(path.sep).join('/');

  return ignoreEntries.some((entry) => {
    const normalizedEntry = entry.replace(/\\/g, '/').replace(/\/$/, '');

    if (!normalizedEntry) {
      return false;
    }

    return normalizedPath === normalizedEntry || normalizedPath.startsWith(`${normalizedEntry}/`);
  });
}

async function listFiles(root: string, options: CreateSnapshotOptions): Promise<string[]> {
  const ignoreEntries = [...DEFAULT_IGNORES, ...(await readIgnoreFile(root)), ...(options.ignore ?? [])];
  const normalizedExtensions = options.includeExtensions?.map((ext) => ext.toLowerCase());
  const results: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (DEFAULT_IGNORES.has(entry.name)) {
        continue;
      }

      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(root, absolutePath);
      if (shouldIgnore(relativePath, ignoreEntries)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (normalizedExtensions?.length) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!normalizedExtensions.includes(ext)) {
          continue;
        }
      }

      results.push(relativePath);
    }
  }

  await walk(root);
  return results.sort((a, b) => a.localeCompare(b));
}

async function fileToEntry(root: string, relativePath: string): Promise<SnapshotFile> {
  const absolutePath = path.join(root, relativePath);
  const [stat, contents] = await Promise.all([fs.stat(absolutePath), fs.readFile(absolutePath)]);
  const hash = createHash('sha256').update(contents).digest('hex');

  return {
    path: relativePath,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    hash
  };
}

export async function createSnapshotManifest(
  projectRoot: string,
  options: CreateSnapshotOptions = {}
): Promise<SnapshotManifest> {
  const files = await listFiles(projectRoot, options);
  const entries = await Promise.all(files.map((relativePath) => fileToEntry(projectRoot, relativePath)));
  const totalSize = entries.reduce((sum, file) => sum + file.size, 0);

  return {
    projectRoot: path.resolve(projectRoot),
    createdAt: new Date().toISOString(),
    totalFiles: entries.length,
    totalSize,
    files: entries
  };
}

export function diffSnapshotManifests(before: SnapshotManifest, after: SnapshotManifest): SnapshotDiff {
  const beforeMap = new Map(before.files.map((file) => [file.path, file]));
  const afterMap = new Map(after.files.map((file) => [file.path, file]));

  const added = after.files.filter((file) => !beforeMap.has(file.path));
  const removed = before.files.filter((file) => !afterMap.has(file.path));
  const changed = after.files.flatMap((file) => {
    const oldFile = beforeMap.get(file.path);
    if (!oldFile) {
      return [];
    }

    if (oldFile.hash === file.hash && oldFile.size === file.size) {
      return [];
    }

    return [{ before: oldFile, after: file }];
  });

  return { added, removed, changed };
}
