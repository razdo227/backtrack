#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createSnapshotManifest, diffSnapshotManifests } from './snapshot.js';
import { checkProjectIntegrity } from './integrity.js';
import {
  listSnapshots,
  loadSnapshotManifest,
  rollbackSnapshot,
  saveSnapshotToStore,
  restoreSnapshot
} from './storage.js';
import type { SnapshotManifest } from './types.js';

const DEFAULT_EXTENSIONS = ['.als', '.adg', '.adv', '.wav', '.aif', '.aiff', '.mp3', '.mid'];

function printUsage(): void {
  console.log(`Backtrack CLI

Usage:
  backtrack snapshot <projectDir> [outputFile] [--include .als,.wav]
  backtrack diff <before.json> <after.json>
  backtrack store <projectDir> [--store <dir>] [--include .als,.wav]
  backtrack list [--store <dir>] [--project <dir>]
  backtrack restore <snapshotId> <targetDir> [--store <dir>] [--overwrite]
  backtrack rollback <snapshotId> [--store <dir>] [--overwrite]
  backtrack check <projectDir> (--snapshot <id> | --manifest <file>) [--store <dir>]
`);
}

function takeOption(args: string[], name: string): string | undefined {
  const eqIndex = args.findIndex((arg) => arg.startsWith(`${name}=`));
  if (eqIndex >= 0) {
    const [_, value] = args[eqIndex].split('=');
    args.splice(eqIndex, 1);
    return value;
  }

  const idx = args.indexOf(name);
  if (idx >= 0) {
    const value = args[idx + 1];
    args.splice(idx, 2);
    return value;
  }

  return undefined;
}

function hasFlag(args: string[], name: string): boolean {
  const idx = args.indexOf(name);
  if (idx >= 0) {
    args.splice(idx, 1);
    return true;
  }
  return false;
}

function parseExtensions(input?: string): string[] | undefined {
  if (!input) {
    return undefined;
  }
  return input
    .split(',')
    .map((ext) => ext.trim())
    .filter(Boolean)
    .map((ext) => (ext.startsWith('.') ? ext : `.${ext}`));
}

async function run(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    return;
  }

  if (command === 'snapshot') {
    const includeRaw = takeOption(args, '--include');
    const [projectDir = '.', outputFile] = args;
    const manifest = await createSnapshotManifest(path.resolve(projectDir), {
      includeExtensions: parseExtensions(includeRaw) ?? DEFAULT_EXTENSIONS
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

  if (command === 'store') {
    const storeDir = takeOption(args, '--store');
    const includeRaw = takeOption(args, '--include');
    const [projectDir = '.'] = args;
    const result = await saveSnapshotToStore(path.resolve(projectDir), {
      storeDir,
      includeExtensions: parseExtensions(includeRaw) ?? DEFAULT_EXTENSIONS
    });
    console.log(JSON.stringify(result.record, null, 2));
    return;
  }

  if (command === 'list') {
    const storeDir = takeOption(args, '--store') ?? path.join(process.cwd(), '.backtrack');
    const projectDir = takeOption(args, '--project');
    const snapshots = await listSnapshots(storeDir, projectDir);
    console.log(JSON.stringify(snapshots, null, 2));
    return;
  }

  if (command === 'restore') {
    const storeDir = takeOption(args, '--store');
    const overwrite = hasFlag(args, '--overwrite');
    const [snapshotId, targetDir] = args;
    if (!snapshotId || !targetDir) {
      throw new Error('restore requires <snapshotId> <targetDir>');
    }

    const result = await restoreSnapshot(snapshotId, {
      storeDir,
      targetDir: path.resolve(targetDir),
      overwrite
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'rollback') {
    const storeDir = takeOption(args, '--store');
    const overwrite = hasFlag(args, '--overwrite');
    const [snapshotId] = args;
    if (!snapshotId) {
      throw new Error('rollback requires <snapshotId>');
    }

    const result = await rollbackSnapshot(snapshotId, { storeDir, overwrite });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'check') {
    const storeDir = takeOption(args, '--store');
    const snapshotId = takeOption(args, '--snapshot');
    const manifestFile = takeOption(args, '--manifest');
    const [projectDir = '.'] = args;

    if (!snapshotId && !manifestFile) {
      throw new Error('check requires --snapshot <id> or --manifest <file>');
    }

    let manifest: SnapshotManifest;
    if (snapshotId) {
      if (!storeDir) {
        throw new Error('check with --snapshot requires --store to locate manifests');
      }
      manifest = await loadSnapshotManifest(storeDir, snapshotId);
    } else if (manifestFile) {
      const raw = await fs.readFile(manifestFile, 'utf8');
      manifest = JSON.parse(raw) as SnapshotManifest;
    } else {
      throw new Error('No manifest available for integrity check');
    }

    const report = await checkProjectIntegrity(path.resolve(projectDir), manifest);
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
