import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createSnapshotManifest, diffSnapshotManifests } from '../src/snapshot.js';

const tempDirs: string[] = [];

async function makeProject(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'backtrack-'));
  tempDirs.push(dir);

  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const absolutePath = path.join(dir, relativePath);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, contents, 'utf8');
    })
  );

  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('createSnapshotManifest', () => {
  it('includes only requested media/session extensions and computes totals', async () => {
    const projectDir = await makeProject({
      'Song.als': 'session-data',
      'Samples/Kick.wav': 'kick',
      'Notes/todo.txt': 'ignore me'
    });

    const manifest = await createSnapshotManifest(projectDir, {
      includeExtensions: ['.als', '.wav']
    });

    expect(manifest.totalFiles).toBe(2);
    expect(manifest.files.map((file) => file.path)).toEqual(['Samples/Kick.wav', 'Song.als']);
    expect(manifest.totalSize).toBe('kick'.length + 'session-data'.length);
  });

  it('ignores standard junk directories by default', async () => {
    const projectDir = await makeProject({
      '.git/config': 'ignored',
      'node_modules/pkg/index.js': 'ignored',
      'Song.als': 'kept'
    });

    const manifest = await createSnapshotManifest(projectDir);
    expect(manifest.files.map((file) => file.path)).toEqual(['Song.als']);
  });

  it('respects .backtrackignore entries for project-specific exclusions', async () => {
    const projectDir = await makeProject({
      '.backtrackignore': '# comment\nExports\nStems/final\n',
      'Song.als': 'kept',
      'Exports/mixdown.wav': 'ignored',
      'Stems/final/vox.wav': 'ignored',
      'Stems/draft/vox.wav': 'kept too'
    });

    const manifest = await createSnapshotManifest(projectDir, {
      includeExtensions: ['.als', '.wav']
    });

    expect(manifest.files.map((file) => file.path)).toEqual(['Song.als', 'Stems/draft/vox.wav']);
  });
});

describe('diffSnapshotManifests', () => {
  it('detects added, removed, and changed files', async () => {
    const beforeDir = await makeProject({
      'Song.als': 'v1',
      'Samples/Kick.wav': 'kick'
    });
    const afterDir = await makeProject({
      'Song.als': 'v2',
      'Samples/Snare.wav': 'snare'
    });

    const before = await createSnapshotManifest(beforeDir, { includeExtensions: ['.als', '.wav'] });
    const after = await createSnapshotManifest(afterDir, { includeExtensions: ['.als', '.wav'] });
    const diff = diffSnapshotManifests(before, after);

    expect(diff.added.map((file) => file.path)).toEqual(['Samples/Snare.wav']);
    expect(diff.removed.map((file) => file.path)).toEqual(['Samples/Kick.wav']);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]?.before.path).toBe('Song.als');
    expect(diff.changed[0]?.after.path).toBe('Song.als');
  });
});
