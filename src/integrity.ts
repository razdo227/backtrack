import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SnapshotManifest } from './types.js';

const SAMPLE_EXTENSIONS = new Set(['.wav', '.aif', '.aiff', '.mp3', '.flac', '.ogg']);

export interface IntegrityReport {
  projectRoot: string;
  checkedAt: string;
  missingFiles: string[];
  missingSamples: string[];
}

export async function checkProjectIntegrity(
  projectRoot: string,
  manifest: SnapshotManifest
): Promise<IntegrityReport> {
  const resolvedRoot = path.resolve(projectRoot);
  const missingFiles: string[] = [];
  const missingSamples: string[] = [];

  await Promise.all(
    manifest.files.map(async (file) => {
      const absolutePath = path.join(resolvedRoot, file.path);
      try {
        await fs.access(absolutePath);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
        missingFiles.push(file.path);
        const ext = path.extname(file.path).toLowerCase();
        if (SAMPLE_EXTENSIONS.has(ext)) {
          missingSamples.push(file.path);
        }
      }
    })
  );

  missingFiles.sort();
  missingSamples.sort();

  return {
    projectRoot: resolvedRoot,
    checkedAt: new Date().toISOString(),
    missingFiles,
    missingSamples
  };
}
