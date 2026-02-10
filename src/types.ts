export interface MachineConfig {
  globalConfigPath: string;
  projects: Record<string, string>; // name → absolute path
}

export interface SyncConfig {
  machines: Record<string, MachineConfig>; // hostname → config
}

export interface ConfigFile {
  /** Human-readable label like "global/CLAUDE.md" or "projects/apm-r-app/CLAUDE.md" */
  label: string;
  /** Absolute path on the local machine */
  localPath: string;
  /** Path inside the repo's configs/<machine>/ directory */
  repoPath: string;
}

export type FileStatus = "identical" | "modified" | "local-only" | "repo-only" | "missing-both";

export interface DiffResult {
  file: ConfigFile;
  status: FileStatus;
  diff?: string;
  newerSide?: "local" | "repo";
}
