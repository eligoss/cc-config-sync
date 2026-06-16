import { readdirSync, statSync, type Dirent } from "node:fs";
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
const EXCLUDED_ROOT_MD = new Set(
  GLOBAL_FILES.filter((file) => file.endsWith(".md") && !file.includes("/")),
);

/**
 * Returns true if the entry is a regular file or a symlink that resolves to a
 * regular file. Broken/non-file symlinks and directories return false.
 */
function isDiscoverableFile(dir: string, entry: Dirent): boolean {
  if (entry.isFile()) {
    return true;
  }
  if (!entry.isSymbolicLink()) {
    return false;
  }
  try {
    return statSync(join(dir, entry.name)).isFile();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return false;
    }
    throw error;
  }
}

/**
 * Discover files from the union of a local and repo directory.
 * This ensures bi-directional discovery: `pull` picks up new local files,
 * and `push` picks up new repo files.
 */
function discoverDirFiles(
  localDir: string,
  repoDir: string,
  filter: (entry: Dirent) => boolean,
  labelPrefix: string,
  makeLocalPath: (name: string) => string,
  makeRepoPath: (name: string) => string,
): ConfigFile[] {
  const names = new Set<string>();
  const addNames = (dir: string): void => {
    try {
      readdirSync(dir, { withFileTypes: true })
        .filter((entry) => isDiscoverableFile(dir, entry) && filter(entry))
        .forEach((entry) => names.add(entry.name));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") {
        throw error;
      }
    }
  };

  addNames(localDir);
  addNames(repoDir);

  return [...names].sort().map((name) => ({
    label: `${labelPrefix}/${name}`,
    localPath: makeLocalPath(name),
    repoPath: makeRepoPath(name),
  }));
}

/**
 * Recursively discover files across the union of a local and repo directory
 * tree, preserving relative sub-paths. Needed for nested config trees like
 * `.claude/skills/<name>/SKILL.md` (+ `references/`) where the flat
 * discoverDirFiles scan is insufficient. Dot entries (e.g. `.DS_Store`) are
 * skipped at every level. Only regular directories are recursed into;
 * symlinked directories are not traversed (symlinks resolve to regular files
 * only) to avoid cycles.
 */
function discoverDirFilesRecursive(
  localDir: string,
  repoDir: string,
  labelPrefix: string,
  makeLocalPath: (relPath: string) => string,
  makeRepoPath: (relPath: string) => string,
): ConfigFile[] {
  const relPaths = new Set<string>();
  const walk = (baseDir: string, subPath: string): void => {
    const currentDir = subPath ? join(baseDir, subPath) : baseDir;
    let entries: Dirent[];
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") {
        return;
      }
      throw error;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const rel = subPath ? `${subPath}/${entry.name}` : entry.name;
      if (isDiscoverableFile(currentDir, entry)) {
        relPaths.add(rel);
      } else if (entry.isDirectory()) {
        walk(baseDir, rel);
      }
    }
  };

  walk(localDir, "");
  walk(repoDir, "");

  return [...relPaths].sort().map((rel) => ({
    label: `${labelPrefix}/${rel}`,
    localPath: makeLocalPath(rel),
    repoPath: makeRepoPath(rel),
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
      (entry) => entry.name.endsWith(".sh"),
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
      (entry) => entry.name.endsWith(".md"),
      "global/rules",
      (name) => join(localRulesDir, name),
      (name) => join(repoRulesDir, name),
    ),
  );

  // Global commands (bi-directional: local + repo)
  const localCommandsDir = join(machineConfig.globalConfigPath, "commands");
  const repoCommandsDir = join(machineDir, "global", "commands");
  files.push(
    ...discoverDirFiles(
      localCommandsDir,
      repoCommandsDir,
      (entry) => entry.name.endsWith(".md"),
      "global/commands",
      (name) => join(localCommandsDir, name),
      (name) => join(repoCommandsDir, name),
    ),
  );

  // Extra root .md files (IDENTITY.md, SOUL.md, etc. — excludes CLAUDE.md)
  const localGlobalDir = machineConfig.globalConfigPath;
  const repoGlobalDir = join(machineDir, "global");
  files.push(
    ...discoverDirFiles(
      localGlobalDir,
      repoGlobalDir,
      (entry) => entry.name.endsWith(".md") && !EXCLUDED_ROOT_MD.has(entry.name),
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

    // Per-project skills (recursive: .claude/skills/<name>/SKILL.md + references)
    const localSkillsDir = join(projectPath, ".claude", "skills");
    const repoSkillsDir = join(machineDir, "projects", projectName, ".claude", "skills");
    files.push(
      ...discoverDirFilesRecursive(
        localSkillsDir,
        repoSkillsDir,
        `projects/${projectName}/.claude/skills`,
        (rel) => join(localSkillsDir, rel),
        (rel) => join(repoSkillsDir, rel),
      ),
    );
  }

  return files;
}
