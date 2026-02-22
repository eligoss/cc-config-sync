import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { setUserConfigRepo, getUserConfigRepo, USER_CONFIG_PATH } from "../user-config.js";

export function configSetRepoCommand(repoPath: string): void {
  const resolved = resolve(repoPath);
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
  console.log(`repo: ${repo}`);
  console.log(`config file: ${USER_CONFIG_PATH}`);
}
