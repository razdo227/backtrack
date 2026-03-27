#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createSnapshotManifest, diffSnapshotManifests } from './snapshot.js';

function printUsage(): void {
  console.log(`Backtrack CLI

Usage:
  backtrack snapshot <projectDir> [outputFile]
  backtrack diff <before.json> <after.json>`);
}

async function run(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    return;
  }

  if (command === 'snapshot') {
    const [projectDir = '.', outputFile] = args;
    const manifest = await createSnapshotManifest(path.resolve(projectDir), {
      includeExtensions: ['.als', '.adg', '.adv', '.wav', '.aif', '.aiff', '.mp3', '.mid']
    });
    const json = JSON.stringify(manifest, null, 2);

    if (outputFile) {
      await fs.writeFile(outputFile, json + '\n', 'utf8');
      console.log(`Wrote snapshot to ${outputFile}`);
      return;
    }

    console.log(json);
    return;
  }

  if (command === 'diff') {
    const [beforeFile, afterFile] = args;
    if (!beforeFile || !afterFile) {
      throw new Error('diff requires <before.json> and <after.json>');
    }

    const [beforeRaw, afterRaw] = await Promise.all([
      fs.readFile(beforeFile, 'utf8'),
      fs.readFile(afterFile, 'utf8')
    ]);
    const diff = diffSnapshotManifests(JSON.parse(beforeRaw), JSON.parse(afterRaw));
    console.log(JSON.stringify(diff, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
