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

/**
 * Helper to set up per-path mocks for existsSync and readdirSync.
 * `dirs` maps directory path to an array of filenames it contains.
 * Paths not in the map return false for existsSync and [] for readdirSync.
 */
function mockDirs(dirs: Record<string, string[]>): void {
  vi.mocked(existsSync).mockImplementation((p) => {
    const path = typeof p === "string" ? p : p.toString();
    return path in dirs;
  });
  vi.mocked(readdirSync).mockImplementation((p) => {
    const path = typeof p === "string" ? p.toString() : p.toString();
    return (dirs[path] ?? []) as unknown as ReturnType<typeof readdirSync>;
  });
}

describe("getConfigFiles", () => {
  const baseMachine: MachineConfig = {
    globalConfigPath: "/Users/me/.claude",
    projects: {},
  };

  beforeEach(() => {
    // By default, no dynamic dirs exist — only static GLOBAL_FILES are returned
    mockDirs({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 5 global config files when no dynamic dirs exist", () => {
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

    // 5 global + 0 hooks + 0 rules + 0 extra md + 4 per project x 2 = 13
    expect(files).toHaveLength(13);
  });

  it("handles empty projects", () => {
    const files = getConfigFiles("my-mac", baseMachine);

    expect(files).toHaveLength(5); // only global files
    expect(files.every((f) => f.label.startsWith("global/"))).toBe(true);
  });

  describe("hook file discovery (bi-directional)", () => {
    it("discovers hooks from repo dir only", () => {
      mockDirs({
        "/sync-repo/configs/my-mac/global/hooks": ["session-start.sh", "block-main-commit.sh"],
      });

      const files = getConfigFiles("my-mac", baseMachine);

      expect(files).toHaveLength(7); // 5 global + 2 hooks
      expect(files.map((f) => f.label)).toContain("global/hooks/block-main-commit.sh");
      expect(files.map((f) => f.label)).toContain("global/hooks/session-start.sh");
    });

    it("discovers hooks from local dir only (pull scenario)", () => {
      mockDirs({
        "/Users/me/.claude/hooks": ["new-hook.sh"],
      });

      const files = getConfigFiles("my-mac", baseMachine);

      expect(files).toHaveLength(6); // 5 global + 1 hook
      expect(files.map((f) => f.label)).toContain("global/hooks/new-hook.sh");
    });

    it("takes union of local and repo hook dirs", () => {
      mockDirs({
        "/Users/me/.claude/hooks": ["local-only.sh", "shared.sh"],
        "/sync-repo/configs/my-mac/global/hooks": ["repo-only.sh", "shared.sh"],
      });

      const files = getConfigFiles("my-mac", baseMachine);
      const hookLabels = files
        .filter((f) => f.label.startsWith("global/hooks/"))
        .map((f) => f.label);

      expect(hookLabels).toEqual([
        "global/hooks/local-only.sh",
        "global/hooks/repo-only.sh",
        "global/hooks/shared.sh",
      ]);
    });

    it("uses correct localPath for hook files", () => {
      mockDirs({
        "/sync-repo/configs/my-mac/global/hooks": ["session-start.sh"],
      });

      const files = getConfigFiles("my-mac", baseMachine);
      const hook = files.find((f) => f.label === "global/hooks/session-start.sh")!;

      expect(hook.localPath).toBe("/Users/me/.claude/hooks/session-start.sh");
    });

    it("uses correct repoPath for hook files", () => {
      mockDirs({
        "/sync-repo/configs/my-mac/global/hooks": ["session-start.sh"],
      });

      const files = getConfigFiles("my-mac", baseMachine);
      const hook = files.find((f) => f.label === "global/hooks/session-start.sh")!;

      expect(hook.repoPath).toBe("/sync-repo/configs/my-mac/global/hooks/session-start.sh");
    });

    it("excludes non-.sh files from hooks dir", () => {
      mockDirs({
        "/sync-repo/configs/my-mac/global/hooks": ["session-start.sh", "README.md", "config.json"],
      });

      const files = getConfigFiles("my-mac", baseMachine);

      expect(files).toHaveLength(6); // 5 global + 1 hook
      expect(files.map((f) => f.label)).toContain("global/hooks/session-start.sh");
      expect(files.map((f) => f.label)).not.toContain("global/hooks/README.md");
      expect(files.map((f) => f.label)).not.toContain("global/hooks/config.json");
    });

    it("adds no hooks when neither dir exists", () => {
      const files = getConfigFiles("my-mac", baseMachine);

      expect(files).toHaveLength(5);
      expect(files.every((f) => !f.label.startsWith("global/hooks/"))).toBe(true);
    });
  });

  describe("rules/ discovery", () => {
    it("discovers rules from local dir only", () => {
      mockDirs({
        "/Users/me/.claude/rules": ["no-console.md", "prefer-const.md"],
      });

      const files = getConfigFiles("my-mac", baseMachine);
      const ruleLabels = files
        .filter((f) => f.label.startsWith("global/rules/"))
        .map((f) => f.label);

      expect(ruleLabels).toEqual(["global/rules/no-console.md", "global/rules/prefer-const.md"]);
    });

    it("discovers rules from repo dir only", () => {
      mockDirs({
        "/sync-repo/configs/my-mac/global/rules": ["style-guide.md"],
      });

      const files = getConfigFiles("my-mac", baseMachine);
      const ruleLabels = files
        .filter((f) => f.label.startsWith("global/rules/"))
        .map((f) => f.label);

      expect(ruleLabels).toEqual(["global/rules/style-guide.md"]);
    });

    it("takes union of local and repo rule dirs", () => {
      mockDirs({
        "/Users/me/.claude/rules": ["local-rule.md", "shared-rule.md"],
        "/sync-repo/configs/my-mac/global/rules": ["repo-rule.md", "shared-rule.md"],
      });

      const files = getConfigFiles("my-mac", baseMachine);
      const ruleLabels = files
        .filter((f) => f.label.startsWith("global/rules/"))
        .map((f) => f.label);

      expect(ruleLabels).toEqual([
        "global/rules/local-rule.md",
        "global/rules/repo-rule.md",
        "global/rules/shared-rule.md",
      ]);
    });

    it("uses correct paths for rule files", () => {
      mockDirs({
        "/Users/me/.claude/rules": ["no-console.md"],
      });

      const files = getConfigFiles("my-mac", baseMachine);
      const rule = files.find((f) => f.label === "global/rules/no-console.md")!;

      expect(rule.localPath).toBe("/Users/me/.claude/rules/no-console.md");
      expect(rule.repoPath).toBe("/sync-repo/configs/my-mac/global/rules/no-console.md");
    });

    it("only includes .md files in rules dir", () => {
      mockDirs({
        "/Users/me/.claude/rules": ["valid-rule.md", "notes.txt", "script.sh"],
      });

      const files = getConfigFiles("my-mac", baseMachine);
      const ruleLabels = files
        .filter((f) => f.label.startsWith("global/rules/"))
        .map((f) => f.label);

      expect(ruleLabels).toEqual(["global/rules/valid-rule.md"]);
    });

    it("adds no rules when neither dir exists", () => {
      const files = getConfigFiles("my-mac", baseMachine);

      expect(files.filter((f) => f.label.startsWith("global/rules/"))).toHaveLength(0);
    });
  });

  describe("extra root .md files discovery", () => {
    it("discovers IDENTITY.md and SOUL.md from local dir", () => {
      mockDirs({
        "/Users/me/.claude": ["CLAUDE.md", "IDENTITY.md", "SOUL.md", "settings.json"],
      });

      const files = getConfigFiles("my-mac", baseMachine);
      const extraMdLabels = files
        .filter((f) => f.label.match(/^global\/[^/]+\.md$/) && f.label !== "global/CLAUDE.md")
        .map((f) => f.label);

      expect(extraMdLabels).toEqual(["global/IDENTITY.md", "global/SOUL.md"]);
    });

    it("excludes CLAUDE.md from extra root discovery", () => {
      mockDirs({
        "/Users/me/.claude": ["CLAUDE.md", "IDENTITY.md"],
      });

      const files = getConfigFiles("my-mac", baseMachine);
      const extraMdLabels = files
        .filter((f) => f.label.match(/^global\/[^/]+\.md$/) && f.label !== "global/CLAUDE.md")
        .map((f) => f.label);

      // IDENTITY.md discovered, CLAUDE.md excluded (already in GLOBAL_FILES)
      expect(extraMdLabels).toEqual(["global/IDENTITY.md"]);
    });

    it("discovers extra .md from repo dir only", () => {
      mockDirs({
        "/sync-repo/configs/my-mac/global": ["SOUL.md", "CLAUDE.md", "settings.json"],
      });

      const files = getConfigFiles("my-mac", baseMachine);
      const extraMdLabels = files
        .filter((f) => f.label.match(/^global\/[^/]+\.md$/) && f.label !== "global/CLAUDE.md")
        .map((f) => f.label);

      expect(extraMdLabels).toEqual(["global/SOUL.md"]);
    });

    it("takes union of local and repo for extra .md files", () => {
      mockDirs({
        "/Users/me/.claude": ["IDENTITY.md"],
        "/sync-repo/configs/my-mac/global": ["SOUL.md", "IDENTITY.md"],
      });

      const files = getConfigFiles("my-mac", baseMachine);
      const extraMdLabels = files
        .filter((f) => f.label.match(/^global\/[^/]+\.md$/) && f.label !== "global/CLAUDE.md")
        .map((f) => f.label);

      expect(extraMdLabels).toEqual(["global/IDENTITY.md", "global/SOUL.md"]);
    });

    it("uses correct paths for extra .md files", () => {
      mockDirs({
        "/Users/me/.claude": ["IDENTITY.md"],
      });

      const files = getConfigFiles("my-mac", baseMachine);
      const identity = files.find((f) => f.label === "global/IDENTITY.md")!;

      expect(identity.localPath).toBe("/Users/me/.claude/IDENTITY.md");
      expect(identity.repoPath).toBe("/sync-repo/configs/my-mac/global/IDENTITY.md");
    });

    it("ignores non-.md files in root dir", () => {
      mockDirs({
        "/Users/me/.claude": ["IDENTITY.md", "settings.json", "settings.local.json"],
      });

      const files = getConfigFiles("my-mac", baseMachine);
      const extraMdLabels = files
        .filter((f) => f.label.match(/^global\/[^/]+\.md$/) && f.label !== "global/CLAUDE.md")
        .map((f) => f.label);

      expect(extraMdLabels).toEqual(["global/IDENTITY.md"]);
    });

    it("adds no extra .md when neither dir exists", () => {
      const files = getConfigFiles("my-mac", baseMachine);

      const extraMdLabels = files
        .filter((f) => f.label.match(/^global\/[^/]+\.md$/) && f.label !== "global/CLAUDE.md")
        .map((f) => f.label);

      expect(extraMdLabels).toHaveLength(0);
    });
  });

  describe("combined discovery", () => {
    it("includes hooks, rules, and extra .md in correct order", () => {
      mockDirs({
        "/Users/me/.claude/hooks": ["pre-commit.sh"],
        "/Users/me/.claude/rules": ["style.md"],
        "/Users/me/.claude": ["IDENTITY.md", "SOUL.md"],
      });

      const files = getConfigFiles("my-mac", baseMachine);
      const labels = files.map((f) => f.label);

      // 5 global static + 1 hook + 1 rule + 2 extra .md = 9
      expect(files).toHaveLength(9);
      expect(labels).toEqual([
        "global/CLAUDE.md",
        "global/settings.json",
        "global/settings.local.json",
        "global/plugins/installed_plugins.json",
        "global/plugins/known_marketplaces.json",
        "global/hooks/pre-commit.sh",
        "global/rules/style.md",
        "global/IDENTITY.md",
        "global/SOUL.md",
      ]);
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
