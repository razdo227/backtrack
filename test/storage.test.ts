import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkProjectIntegrity } from '../src/integrity.js';
import { restoreSnapshot, saveSnapshotToStore, listSnapshots } from '../src/storage.js';

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'backtrack-'));
  tempDirs.push(dir);
  return dir;
}

async function writeProjectFiles(projectDir: string, files: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const absolutePath = path.join(projectDir, relativePath);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, contents, 'utf8');
    })
  );
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('snapshot storage + restore', () => {
  it('stores manifests, indexes snapshots, and restores files', async () => {
    const projectDir = await makeTempDir();
    await writeProjectFiles(projectDir, {
      'Song.als': 'session-v1',
      'Samples/Kick.wav': 'kick'
    });

    const storeDir = await makeTempDir();
    const { record, manifest } = await saveSnapshotToStore(projectDir, {
      storeDir,
      includeExtensions: ['.als', '.wav']
    });

    expect(record.id).toMatch(/^snap_/);
    const snapshots = await listSnapshots(storeDir, projectDir);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.id).toBe(record.id);

    const restoreDir = await makeTempDir();
    const result = await restoreSnapshot(record.id, {
      storeDir,
      targetDir: restoreDir
    });
    expect(result.restoredFiles).toBe(manifest.totalFiles);

    const restoredSong = await fs.readFile(path.join(restoreDir, 'Song.als'), 'utf8');
    const restoredKick = await fs.readFile(path.join(restoreDir, 'Samples/Kick.wav'), 'utf8');
    expect(restoredSong).toBe('session-v1');
    expect(restoredKick).toBe('kick');
  });
});

describe('project integrity check', () => {
  it('reports missing sample files', async () => {
    const projectDir = await makeTempDir();
    await writeProjectFiles(projectDir, {
      'Song.als': 'session-v1',
      'Samples/Kick.wav': 'kick',
      'Samples/Snare.wav': 'snare'
    });

    const storeDir = await makeTempDir();
    const { manifest } = await saveSnapshotToStore(projectDir, {
      storeDir,
      includeExtensions: ['.als', '.wav']
    });

    await fs.rm(path.join(projectDir, 'Samples/Snare.wav'));

    const report = await checkProjectIntegrity(projectDir, manifest);
    expect(report.missingSamples).toEqual(['Samples/Snare.wav']);
    expect(report.missingFiles).toEqual(['Samples/Snare.wav']);
  });
});
