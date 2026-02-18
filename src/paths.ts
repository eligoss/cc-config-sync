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
