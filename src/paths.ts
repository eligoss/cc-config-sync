import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getConfigsDir } from "./config.js";
import type { ConfigFile, MachineConfig } from "./types.js";

const GLOBAL_FILES = [
  "CLAUDE.md",
  "settings.json",
  "settings.local.json",
  "plugins/installed_plugins.json",
  "plugins/known_marketplaces.json",
];
const PROJECT_ROOT_FILES = ["CLAUDE.md"];
const PROJECT_CLAUDE_FILES = [".claude/settings.json", ".claude/settings.local.json"];
const PROJECT_MEMORY_FILES = ["MEMORY.md"];

/** Root .md files already tracked via GLOBAL_FILES — excluded from extra root discovery. */
const EXCLUDED_ROOT_MD = new Set(["CLAUDE.md"]);

/**
 * Discover files from the union of a local and repo directory.
 * This ensures bi-directional discovery: `pull` picks up new local files,
 * and `push` picks up new repo files.
 */
function discoverDirFiles(
  localDir: string,
  repoDir: string,
  filter: (name: string) => boolean,
  labelPrefix: string,
  makeLocalPath: (name: string) => string,
  makeRepoPath: (name: string) => string,
): ConfigFile[] {
  const names = new Set<string>();
  if (existsSync(localDir)) {
    readdirSync(localDir)
      .filter(filter)
      .forEach((n) => names.add(n));
  }
  if (existsSync(repoDir)) {
    readdirSync(repoDir)
      .filter(filter)
      .forEach((n) => names.add(n));
  }
  return [...names].sort().map((name) => ({
    label: `${labelPrefix}/${name}`,
    localPath: makeLocalPath(name),
    repoPath: makeRepoPath(name),
  }));
}

export function projectPathToClaudeId(projectPath: string): string {
  return projectPath.replace(/\//g, "-");
}

export function getConfigFiles(machineName: string, machineConfig: MachineConfig): ConfigFile[] {
  const files: ConfigFile[] = [];
  const machineDir = join(getConfigsDir(), machineName);

  // Global config files
  for (const file of GLOBAL_FILES) {
    files.push({
      label: `global/${file}`,
      localPath: join(machineConfig.globalConfigPath, file),
      repoPath: join(machineDir, "global", file),
    });
  }

  // Global hook scripts (bi-directional: local + repo)
  const localHooksDir = join(machineConfig.globalConfigPath, "hooks");
  const repoHooksDir = join(machineDir, "global", "hooks");
  files.push(
    ...discoverDirFiles(
      localHooksDir,
      repoHooksDir,
      (f) => f.endsWith(".sh"),
      "global/hooks",
      (name) => join(localHooksDir, name),
      (name) => join(repoHooksDir, name),
    ),
  );

  // Global rules (bi-directional: local + repo)
  const localRulesDir = join(machineConfig.globalConfigPath, "rules");
  const repoRulesDir = join(machineDir, "global", "rules");
  files.push(
    ...discoverDirFiles(
      localRulesDir,
      repoRulesDir,
      (f) => f.endsWith(".md"),
      "global/rules",
      (name) => join(localRulesDir, name),
      (name) => join(repoRulesDir, name),
    ),
  );

  // Extra root .md files (IDENTITY.md, SOUL.md, etc. — excludes CLAUDE.md)
  const localGlobalDir = machineConfig.globalConfigPath;
  const repoGlobalDir = join(machineDir, "global");
  files.push(
    ...discoverDirFiles(
      localGlobalDir,
      repoGlobalDir,
      (f) => f.endsWith(".md") && !EXCLUDED_ROOT_MD.has(f),
      "global",
      (name) => join(localGlobalDir, name),
      (name) => join(repoGlobalDir, name),
    ),
  );

  // Per-project config files
  for (const [projectName, projectPath] of Object.entries(machineConfig.projects)) {
    for (const file of PROJECT_ROOT_FILES) {
      files.push({
        label: `projects/${projectName}/${file}`,
        localPath: join(projectPath, file),
        repoPath: join(machineDir, "projects", projectName, file),
      });
    }
    for (const file of PROJECT_CLAUDE_FILES) {
      files.push({
        label: `projects/${projectName}/${file}`,
        localPath: join(projectPath, file),
        repoPath: join(machineDir, "projects", projectName, file),
      });
    }
    for (const file of PROJECT_MEMORY_FILES) {
      const projectId = projectPathToClaudeId(projectPath);
      files.push({
        label: `projects/${projectName}/memory/${file}`,
        localPath: join(machineConfig.globalConfigPath, "projects", projectId, "memory", file),
        repoPath: join(machineDir, "projects", projectName, "memory", file),
      });
    }
  }

  return files;
}
