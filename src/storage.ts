import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CreateSnapshotOptions } from './snapshot.js';
import { createSnapshotManifest } from './snapshot.js';
import type { SnapshotManifest, SnapshotRecord, SnapshotStoreIndex } from './types.js';

const DEFAULT_STORE_DIR_NAME = '.backtrack';
const INDEX_VERSION = 1;

export interface SaveSnapshotOptions extends CreateSnapshotOptions {
  storeDir?: string;
  snapshotId?: string;
}

export interface RestoreSnapshotOptions {
  storeDir?: string;
  targetDir: string;
  overwrite?: boolean;
}

function resolveStoreDir(projectRoot: string, storeDir?: string): string {
  if (storeDir) {
    return path.resolve(storeDir);
  }

  return path.join(projectRoot, DEFAULT_STORE_DIR_NAME);
}

function indexPath(storeDir: string): string {
  return path.join(storeDir, 'index.json');
}

function manifestsDir(storeDir: string): string {
  return path.join(storeDir, 'manifests');
}

function objectsDir(storeDir: string): string {
  return path.join(storeDir, 'objects', 'sha256');
}

async function ensureStoreDirs(storeDir: string): Promise<void> {
  await Promise.all([
    fs.mkdir(storeDir, { recursive: true }),
    fs.mkdir(manifestsDir(storeDir), { recursive: true }),
    fs.mkdir(objectsDir(storeDir), { recursive: true })
  ]);
}

async function readIndex(storeDir: string): Promise<SnapshotStoreIndex> {
  try {
    const raw = await fs.readFile(indexPath(storeDir), 'utf8');
    const parsed = JSON.parse(raw) as SnapshotStoreIndex;
    if (!parsed || parsed.version !== INDEX_VERSION || !Array.isArray(parsed.snapshots)) {
      throw new Error('Invalid snapshot index format');
    }
    return parsed;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: INDEX_VERSION, snapshots: [] };
    }
    throw error;
  }
}

async function writeIndex(storeDir: string, index: SnapshotStoreIndex): Promise<void> {
  await fs.writeFile(indexPath(storeDir), JSON.stringify(index, null, 2) + '\n', 'utf8');
}

function createSnapshotId(): string {
  return `snap_${new Date().toISOString().replace(/[:.]/g, '-')}_${randomUUID().slice(0, 8)}`;
}

function objectPathForHash(storeDir: string, hash: string): string {
  const prefix = hash.slice(0, 2);
  return path.join(objectsDir(storeDir), prefix, hash);
}

async function ensureObjectForFile(storeDir: string, sourcePath: string, hash: string): Promise<void> {
  const objectPath = objectPathForHash(storeDir, hash);
  try {
    await fs.access(objectPath);
    return;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.mkdir(path.dirname(objectPath), { recursive: true });
  await fs.copyFile(sourcePath, objectPath);
}

export async function saveSnapshotToStore(
  projectRoot: string,
  options: SaveSnapshotOptions = {}
): Promise<{ record: SnapshotRecord; manifest: SnapshotManifest; storeDir: string }> {
  const resolvedRoot = path.resolve(projectRoot);
  const storeDir = resolveStoreDir(resolvedRoot, options.storeDir);
  await ensureStoreDirs(storeDir);

  const manifest = await createSnapshotManifest(resolvedRoot, options);
  const snapshotId = options.snapshotId ?? createSnapshotId();
  const manifestPath = path.join(manifestsDir(storeDir), `${snapshotId}.json`);

  await Promise.all(
    manifest.files.map((file) =>
      ensureObjectForFile(storeDir, path.join(resolvedRoot, file.path), file.hash)
    )
  );

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  const record: SnapshotRecord = {
    id: snapshotId,
    projectRoot: manifest.projectRoot,
    createdAt: manifest.createdAt,
    totalFiles: manifest.totalFiles,
    totalSize: manifest.totalSize,
    manifestPath
  };

  const index = await readIndex(storeDir);
  index.snapshots.unshift(record);
  await writeIndex(storeDir, index);

  return { record, manifest, storeDir };
}

export async function listSnapshots(storeDir: string, projectRoot?: string): Promise<SnapshotRecord[]> {
  const index = await readIndex(storeDir);
  if (!projectRoot) {
    return index.snapshots;
  }
  const resolvedRoot = path.resolve(projectRoot);
  return index.snapshots.filter((snapshot) => snapshot.projectRoot === resolvedRoot);
}

export async function loadSnapshotManifest(storeDir: string, snapshotId: string): Promise<SnapshotManifest> {
  const manifestPath = path.join(manifestsDir(storeDir), `${snapshotId}.json`);
  const raw = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(raw) as SnapshotManifest;
}

export async function restoreSnapshot(
  snapshotId: string,
  options: RestoreSnapshotOptions
): Promise<{ restoredFiles: number; targetDir: string }> {
  const storeDir = resolveStoreDir(process.cwd(), options.storeDir);
  const manifest = await loadSnapshotManifest(storeDir, snapshotId);
  const targetDir = path.resolve(options.targetDir);

  await fs.mkdir(targetDir, { recursive: true });

  await Promise.all(
    manifest.files.map(async (file) => {
      const destination = path.join(targetDir, file.path);
      const objectPath = objectPathForHash(storeDir, file.hash);
      await fs.mkdir(path.dirname(destination), { recursive: true });

      if (!options.overwrite) {
        try {
          await fs.access(destination);
          return;
        } catch (error: unknown) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
        }
      }

      await fs.copyFile(objectPath, destination);
    })
  );

  return { restoredFiles: manifest.files.length, targetDir };
}

export async function rollbackSnapshot(
  snapshotId: string,
  options: { storeDir?: string; overwrite?: boolean }
): Promise<{ restoredFiles: number; targetDir: string }> {
  const storeDir = resolveStoreDir(process.cwd(), options.storeDir);
  const manifest = await loadSnapshotManifest(storeDir, snapshotId);
  return restoreSnapshot(snapshotId, {
    storeDir,
    targetDir: manifest.projectRoot,
    overwrite: options.overwrite ?? false
  });
}
