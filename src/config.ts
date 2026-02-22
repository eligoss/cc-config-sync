import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { SyncConfig } from "./types.js";

let _syncRepoPath: string | null = null;

export function setSyncRepoPath(path: string): void {
  _syncRepoPath = resolve(path);
}

export function getSyncRepoPath(): string {
  if (!_syncRepoPath) {
    console.error("Sync repo path not set. Use --repo <path> or set CLAUDE_SYNC_REPO env var.");
    process.exit(1);
  }
  return _syncRepoPath;
}

export function getConfigsDir(): string {
  return resolve(getSyncRepoPath(), "configs");
}

export function getConfigFile(): string {
  return resolve(getSyncRepoPath(), "sync.config.json");
}

export function loadConfig(): SyncConfig {
  const configFile = getConfigFile();
  if (!existsSync(configFile)) {
    return { machines: {} };
  }
  const raw = readFileSync(configFile, "utf-8");
  try {
    return JSON.parse(raw) as SyncConfig;
  } catch {
    console.error("Error: sync.config.json is malformed. Please fix or delete it.");
    process.exit(1);
  }
}

export function saveConfig(config: SyncConfig): void {
  writeFileSync(getConfigFile(), JSON.stringify(config, null, 2) + "\n");
}
