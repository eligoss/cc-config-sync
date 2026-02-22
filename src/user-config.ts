import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_PATH = join(homedir(), ".cc-config-sync.json");

export function getUserConfigRepo(): string | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { repo?: string };
    return parsed.repo ?? null;
  } catch {
    return null;
  }
}

export function setUserConfigRepo(repoPath: string): void {
  const existing = existsSync(CONFIG_PATH)
    ? (JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as Record<string, unknown>)
    : {};
  writeFileSync(
    CONFIG_PATH,
    JSON.stringify({ ...existing, repo: repoPath }, null, 2) + "\n",
  );
}

export function getUserConfigPath(): string {
  return CONFIG_PATH;
}
