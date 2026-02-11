import { describe, it, expect, vi } from "vitest";

vi.mock("../config.js", () => ({
  getConfigsDir: () => "/sync-repo/configs",
}));

import { getConfigFiles } from "../paths.js";
import type { MachineConfig } from "../types.js";

describe("getConfigFiles", () => {
  const baseMachine: MachineConfig = {
    globalConfigPath: "/Users/me/.claude",
    projects: {},
  };

  it("returns 3 global config files", () => {
    const files = getConfigFiles("my-mac", baseMachine);

    expect(files).toHaveLength(3);
    expect(files.map((f) => f.label)).toEqual([
      "global/CLAUDE.md",
      "global/settings.json",
      "global/settings.local.json",
    ]);
  });

  it("uses correct local paths for global files", () => {
    const files = getConfigFiles("my-mac", baseMachine);

    expect(files[0].localPath).toBe("/Users/me/.claude/CLAUDE.md");
    expect(files[1].localPath).toBe("/Users/me/.claude/settings.json");
    expect(files[2].localPath).toBe("/Users/me/.claude/settings.local.json");
  });

  it("uses correct repo paths for global files", () => {
    const files = getConfigFiles("my-mac", baseMachine);

    expect(files[0].repoPath).toBe("/sync-repo/configs/my-mac/global/CLAUDE.md");
    expect(files[1].repoPath).toBe("/sync-repo/configs/my-mac/global/settings.json");
    expect(files[2].repoPath).toBe("/sync-repo/configs/my-mac/global/settings.local.json");
  });

  it("returns 3 files per project (CLAUDE.md + 2 .claude/ files)", () => {
    const machine: MachineConfig = {
      globalConfigPath: "/Users/me/.claude",
      projects: { "my-app": "/Users/me/projects/my-app" },
    };

    const files = getConfigFiles("my-mac", machine);
    const projectFiles = files.filter((f) => f.label.startsWith("projects/"));

    expect(projectFiles).toHaveLength(3);
    expect(projectFiles.map((f) => f.label)).toEqual([
      "projects/my-app/CLAUDE.md",
      "projects/my-app/.claude/settings.json",
      "projects/my-app/.claude/settings.local.json",
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

    // 3 global + 3 per project × 2 projects = 9
    expect(files).toHaveLength(9);
  });

  it("handles empty projects", () => {
    const files = getConfigFiles("my-mac", baseMachine);

    expect(files).toHaveLength(3); // only global files
    expect(files.every((f) => f.label.startsWith("global/"))).toBe(true);
  });
});
