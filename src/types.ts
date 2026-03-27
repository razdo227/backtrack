export interface SnapshotFile {
  path: string;
  size: number;
  mtimeMs: number;
  hash: string;
}

export interface SnapshotManifest {
  projectRoot: string;
  createdAt: string;
  totalFiles: number;
  totalSize: number;
  files: SnapshotFile[];
}

export interface SnapshotDiff {
  added: SnapshotFile[];
  removed: SnapshotFile[];
  changed: Array<{
    before: SnapshotFile;
    after: SnapshotFile;
  }>;
}
