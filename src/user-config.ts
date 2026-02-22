import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export const USER_CONFIG_PATH = join(homedir(), ".cc-config-sync.json");

function readConfigFile(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(USER_CONFIG_PATH, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getUserConfigRepo(): string | null {
  if (!existsSync(USER_CONFIG_PATH)) return null;
  const parsed = readConfigFile() as { repo?: string };
  return parsed.repo ?? null;
}

export function setUserConfigRepo(repoPath: string): void {
  const existing = readConfigFile();
  writeFileSync(USER_CONFIG_PATH, JSON.stringify({ ...existing, repo: repoPath }, null, 2) + "\n");
}
