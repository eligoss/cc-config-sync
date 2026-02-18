import { describe, it, expect, vi } from "vitest";

vi.mock("../config.js", () => ({
  getConfigsDir: () => "/sync-repo/configs",
}));

import { getConfigFiles, projectPathToClaudeId } from "../paths.js";
import type { MachineConfig } from "../types.js";

describe("getConfigFiles", () => {
  const baseMachine: MachineConfig = {
    globalConfigPath: "/Users/me/.claude",
    projects: {},
  };

  it("returns 5 global config files", () => {
    const files = getConfigFiles("my-mac", baseMachine);

    expect(files).toHaveLength(5);
    expect(files.map((f) => f.label)).toEqual([
      "global/CLAUDE.md",
      "global/settings.json",
      "global/settings.local.json",
      "global/plugins/installed_plugins.json",
      "global/plugins/known_marketplaces.json",
    ]);
  });

  it("uses correct local paths for global files", () => {
    const files = getConfigFiles("my-mac", baseMachine);

    expect(files[0].localPath).toBe("/Users/me/.claude/CLAUDE.md");
    expect(files[1].localPath).toBe("/Users/me/.claude/settings.json");
    expect(files[2].localPath).toBe("/Users/me/.claude/settings.local.json");
    expect(files[3].localPath).toBe("/Users/me/.claude/plugins/installed_plugins.json");
    expect(files[4].localPath).toBe("/Users/me/.claude/plugins/known_marketplaces.json");
  });

  it("uses correct repo paths for global files", () => {
    const files = getConfigFiles("my-mac", baseMachine);

    expect(files[0].repoPath).toBe("/sync-repo/configs/my-mac/global/CLAUDE.md");
    expect(files[1].repoPath).toBe("/sync-repo/configs/my-mac/global/settings.json");
    expect(files[2].repoPath).toBe("/sync-repo/configs/my-mac/global/settings.local.json");
    expect(files[3].repoPath).toBe(
      "/sync-repo/configs/my-mac/global/plugins/installed_plugins.json",
    );
    expect(files[4].repoPath).toBe(
      "/sync-repo/configs/my-mac/global/plugins/known_marketplaces.json",
    );
  });

  it("returns 4 files per project (CLAUDE.md + 2 .claude/ files + memory)", () => {
    const machine: MachineConfig = {
      globalConfigPath: "/Users/me/.claude",
      projects: { "my-app": "/Users/me/projects/my-app" },
    };

    const files = getConfigFiles("my-mac", machine);
    const projectFiles = files.filter((f) => f.label.startsWith("projects/"));

    expect(projectFiles).toHaveLength(4);
    expect(projectFiles.map((f) => f.label)).toEqual([
      "projects/my-app/CLAUDE.md",
      "projects/my-app/.claude/settings.json",
      "projects/my-app/.claude/settings.local.json",
      "projects/my-app/memory/MEMORY.md",
    ]);
  });

  it("uses correct local paths for project files", () => {
    const machine: MachineConfig = {
      globalConfigPath: "/Users/me/.claude",
      projects: { "my-app": "/Users/me/projects/my-app" },
    };

    const files = getConfigFiles("my-mac", machine);
    const projectFiles = files.filter((f) => f.label.startsWith("projects/"));

    expect(projectFiles[0].localPath).toBe("/Users/me/projects/my-app/CLAUDE.md");
    expect(projectFiles[1].localPath).toBe("/Users/me/projects/my-app/.claude/settings.json");
    expect(projectFiles[2].localPath).toBe("/Users/me/projects/my-app/.claude/settings.local.json");
    expect(projectFiles[3].localPath).toBe(
      "/Users/me/.claude/projects/-Users-me-projects-my-app/memory/MEMORY.md",
    );
  });

  it("handles multiple projects", () => {
    const machine: MachineConfig = {
      globalConfigPath: "/Users/me/.claude",
      projects: {
        app: "/Users/me/app",
        api: "/Users/me/api",
      },
    };

    const files = getConfigFiles("my-mac", machine);

    // 5 global + 4 per project × 2 projects = 13
    expect(files).toHaveLength(13);
  });

  it("handles empty projects", () => {
    const files = getConfigFiles("my-mac", baseMachine);

    expect(files).toHaveLength(5); // only global files
    expect(files.every((f) => f.label.startsWith("global/"))).toBe(true);
  });
});

describe("projectPathToClaudeId", () => {
  it("converts forward slashes to hyphens", () => {
    expect(projectPathToClaudeId("/Users/me/projects/my-app")).toBe("-Users-me-projects-my-app");
  });

  it("handles path without leading slash", () => {
    expect(projectPathToClaudeId("Users/me/app")).toBe("Users-me-app");
  });

  it("handles single directory", () => {
    expect(projectPathToClaudeId("/app")).toBe("-app");
  });
});
