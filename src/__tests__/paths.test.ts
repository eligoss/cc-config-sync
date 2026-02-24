import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, readdirSync } from "node:fs";

vi.mock("../config.js", () => ({
  getConfigsDir: () => "/sync-repo/configs",
}));

// Replace only the fs functions used by paths.ts with controllable vi.fn() instances
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
  };
});

import { getConfigFiles, projectPathToClaudeId } from "../paths.js";
import type { MachineConfig } from "../types.js";

describe("getConfigFiles", () => {
  const baseMachine: MachineConfig = {
    globalConfigPath: "/Users/me/.claude",
    projects: {},
  };

  beforeEach(() => {
    // By default, hooks dir does not exist — all existing tests pass unchanged
    vi.mocked(existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

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

    // 5 global + 0 hooks + 4 per project × 2 projects = 13
    expect(files).toHaveLength(13);
  });

  it("handles empty projects", () => {
    const files = getConfigFiles("my-mac", baseMachine);

    expect(files).toHaveLength(5); // only global files
    expect(files.every((f) => f.label.startsWith("global/"))).toBe(true);
  });

  describe("hook file discovery", () => {
    it("adds hook files when hooks dir exists with .sh files", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([
        "session-start.sh",
        "block-main-commit.sh",
      ] as unknown as ReturnType<typeof readdirSync>);

      const files = getConfigFiles("my-mac", baseMachine);

      // 5 global + 2 hooks = 7
      expect(files).toHaveLength(7);
      expect(files.map((f) => f.label)).toContain("global/hooks/session-start.sh");
      expect(files.map((f) => f.label)).toContain("global/hooks/block-main-commit.sh");
    });

    it("uses correct localPath for hook files", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(["session-start.sh"] as unknown as ReturnType<
        typeof readdirSync
      >);

      const files = getConfigFiles("my-mac", baseMachine);
      const hook = files.find((f) => f.label === "global/hooks/session-start.sh")!;

      expect(hook.localPath).toBe("/Users/me/.claude/hooks/session-start.sh");
    });

    it("uses correct repoPath for hook files", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(["session-start.sh"] as unknown as ReturnType<
        typeof readdirSync
      >);

      const files = getConfigFiles("my-mac", baseMachine);
      const hook = files.find((f) => f.label === "global/hooks/session-start.sh")!;

      expect(hook.repoPath).toBe("/sync-repo/configs/my-mac/global/hooks/session-start.sh");
    });

    it("excludes non-.sh files from hooks dir", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([
        "session-start.sh",
        "README.md",
        "config.json",
      ] as unknown as ReturnType<typeof readdirSync>);

      const files = getConfigFiles("my-mac", baseMachine);

      // Only the .sh file is included
      expect(files).toHaveLength(6); // 5 global + 1 hook
      expect(files.map((f) => f.label)).toContain("global/hooks/session-start.sh");
      expect(files.map((f) => f.label)).not.toContain("global/hooks/README.md");
      expect(files.map((f) => f.label)).not.toContain("global/hooks/config.json");
    });

    it("adds no hooks when hooks dir is missing", () => {
      // existsSync already mocked to false in outer beforeEach
      const files = getConfigFiles("my-mac", baseMachine);

      expect(files).toHaveLength(5);
      expect(files.every((f) => !f.label.startsWith("global/hooks/"))).toBe(true);
    });
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
