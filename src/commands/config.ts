import { resolve, isAbsolute } from "node:path";
import { existsSync } from "node:fs";
import {
  setUserConfigRepo,
  getUserConfigRepo,
  getBackupsEnabledRaw,
  USER_CONFIG_PATH,
} from "../user-config.js";

export function configSetRepoCommand(repoPath: string): void {
  const resolved = resolve(repoPath);
  // Warn when a relative path was given — it is resolved against the current working
  // directory at config-write time and stored as an absolute path, so running from a
  // different directory later will not change the stored value.
  if (!isAbsolute(repoPath)) {
    console.error(`Warning: relative path resolved to ${resolved} (from ${process.cwd()})`);
  }
  if (!existsSync(resolved)) {
    console.error(`Warning: ${resolved} does not exist.`);
  }
  setUserConfigRepo(resolved);
  console.log(`Saved repo path: ${resolved}`);
  console.log(`Config file: ${USER_CONFIG_PATH}`);
}

export function configShowCommand(): void {
  const repo = getUserConfigRepo();
  if (!repo) {
    console.error("No repo path configured.");
    console.error(`Run: cc-config-sync config set-repo <path>`);
    return;
  }
  const raw = getBackupsEnabledRaw();
  const backupsLabel = raw === undefined ? "enabled (default)" : raw ? "enabled" : "disabled";
  console.log(`repo:    ${repo}`);
  console.log(`backups: ${backupsLabel}`);
  console.log(`config:  ${USER_CONFIG_PATH}`);
}
