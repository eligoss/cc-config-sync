import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { setUserConfigRepo, getUserConfigRepo, getUserConfigPath } from "../user-config.js";

export function configSetRepoCommand(repoPath: string): void {
  const resolved = resolve(repoPath);
  if (!existsSync(resolved)) {
    console.log(`Warning: ${resolved} does not exist.`);
  }
  setUserConfigRepo(resolved);
  console.log(`Saved repo path: ${resolved}`);
  console.log(`Config file: ${getUserConfigPath()}`);
}

export function configShowCommand(): void {
  const repo = getUserConfigRepo();
  if (!repo) {
    console.log("No repo path configured.");
    console.log(`Run: cc-config-sync config set-repo <path>`);
    return;
  }
  console.log(`repo: ${repo}`);
  console.log(`config file: ${getUserConfigPath()}`);
}
