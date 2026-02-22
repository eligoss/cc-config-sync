/**
 * Integration tests for CLI commands.
 *
 * Each test creates:
 *   - A temp "local" directory (simulates ~/.claude and project dirs)
 *   - A temp "repo" directory (simulates the sync repo)
 *
 * config.setSyncRepoPath(repo) is called before each test so paths resolve
 * to the temp dirs. os.hostname() is mocked to a fixed value to make
 * getCurrentMachineConfig / requireMachineConfig predictable.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

// Stable fake hostname used throughout tests
const FAKE_HOST = "test-machine";

// Mock os module so hostname() returns FAKE_HOST in all imported modules
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    hostname: () => FAKE_HOST,
  };
});

// ── helpers ────────────────────────────────────────────────────────────────

interface TestEnv {
  repo: string;
  local: string;
  projectDir: string;
}

/**
 * Build a minimal in-memory sync config and write it into the repo dir.
 * Returns the machineDir path inside the repo for asserting repo file contents.
 */
function setupEnv(): TestEnv {
  const repo = mkdtempSync(join(tmpdir(), "cc-repo-"));
  const local = mkdtempSync(join(tmpdir(), "cc-local-"));
  const projectDir = mkdtempSync(join(tmpdir(), "cc-proj-"));
  return { repo, local, projectDir };
}

function writeConfig(
  repo: string,
  localGlobal: string,
  projects: Record<string, string> = {},
): void {
  const config = {
    machines: {
      [FAKE_HOST]: {
        globalConfigPath: localGlobal,
        projects,
      },
    },
  };
  writeFileSync(join(repo, "sync.config.json"), JSON.stringify(config, null, 2) + "\n");
}

/** Absolute path to a file in the repo's configs/<machine>/ tree. */
function repoPath(repo: string, ...segments: string[]): string {
  return join(repo, "configs", FAKE_HOST, ...segments);
}

// ── pull ──────────────────────────────────────────────────────────────────

describe("pullCommand", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = setupEnv();
    vi.resetModules();
    const config = await import("../config.js");
    config.setSyncRepoPath(env.repo);
    writeConfig(env.repo, env.local);
  });

  afterEach(() => {
    rmSync(env.repo, { recursive: true, force: true });
    rmSync(env.local, { recursive: true, force: true });
    rmSync(env.projectDir, { recursive: true, force: true });
  });

  it("pullCommand_localFileExists_copiedToRepo", async () => {
    const { pullCommand } = await import("../commands/pull.js");

    // Create a local CLAUDE.md
    writeFileSync(join(env.local, "CLAUDE.md"), "# My global config\n");

    await pullCommand({});

    const dest = repoPath(env.repo, "global", "CLAUDE.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf-8")).toBe("# My global config\n");
  });

  it("pullCommand_dryRun_doesNotCopyFiles", async () => {
    const { pullCommand } = await import("../commands/pull.js");

    writeFileSync(join(env.local, "CLAUDE.md"), "# content\n");

    await pullCommand({ dryRun: true });

    const dest = repoPath(env.repo, "global", "CLAUDE.md");
    expect(existsSync(dest)).toBe(false);
  });

  it("pullCommand_identicalFiles_skipsFile", async () => {
    const { pullCommand } = await import("../commands/pull.js");

    const content = "# same content\n";
    writeFileSync(join(env.local, "CLAUDE.md"), content);

    // Pre-populate repo with identical file
    const dest = repoPath(env.repo, "global", "CLAUDE.md");
    mkdirSync(join(env.repo, "configs", FAKE_HOST, "global"), { recursive: true });
    writeFileSync(dest, content);

    // Capture console output to verify "same" is logged
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg: string) => logs.push(msg));

    await pullCommand({});

    spy.mockRestore();
    expect(logs.some((l) => l.includes("same"))).toBe(true);
  });

  it("pullCommand_missingLocalFile_skipsFile", async () => {
    const { pullCommand } = await import("../commands/pull.js");

    // Do NOT write local CLAUDE.md
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg: string) => logs.push(msg));

    await pullCommand({});

    spy.mockRestore();
    expect(logs.some((l) => l.includes("not found locally"))).toBe(true);
  });
});

// ── push ──────────────────────────────────────────────────────────────────

describe("pushCommand", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = setupEnv();
    vi.resetModules();
    const config = await import("../config.js");
    config.setSyncRepoPath(env.repo);
    writeConfig(env.repo, env.local);
  });

  afterEach(() => {
    rmSync(env.repo, { recursive: true, force: true });
    rmSync(env.local, { recursive: true, force: true });
    rmSync(env.projectDir, { recursive: true, force: true });
  });

  it("pushCommand_yesFlag_copiesRepoFileToLocal", async () => {
    const { pushCommand } = await import("../commands/push.js");

    // Put a file in the repo
    const src = repoPath(env.repo, "global", "CLAUDE.md");
    mkdirSync(join(env.repo, "configs", FAKE_HOST, "global"), { recursive: true });
    writeFileSync(src, "# from repo\n");

    await pushCommand({ yes: true });

    const dest = join(env.local, "CLAUDE.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf-8")).toBe("# from repo\n");
  });

  it("pushCommand_yesFlag_createsBackupOfExistingLocalFile", async () => {
    const { pushCommand } = await import("../commands/push.js");

    const localFile = join(env.local, "CLAUDE.md");
    writeFileSync(localFile, "# old local content\n");

    const src = repoPath(env.repo, "global", "CLAUDE.md");
    mkdirSync(join(env.repo, "configs", FAKE_HOST, "global"), { recursive: true });
    writeFileSync(src, "# new repo content\n");

    await pushCommand({ yes: true });

    // A backup file should exist in the same directory
    const { readdirSync } = await import("node:fs");
    const entries = readdirSync(env.local);
    const backup = entries.find((e) => e.includes(".backup-"));
    expect(backup).toBeDefined();

    // The local file should now contain the repo content (written after backup)
    expect(existsSync(localFile)).toBe(true);
    const newContent = readFileSync(localFile, "utf-8");
    expect(newContent).toBe("# new repo content\n");
  });

  it("pushCommand_dryRun_doesNotCopyFiles", async () => {
    const { pushCommand } = await import("../commands/push.js");

    const src = repoPath(env.repo, "global", "CLAUDE.md");
    mkdirSync(join(env.repo, "configs", FAKE_HOST, "global"), { recursive: true });
    writeFileSync(src, "# repo content\n");

    await pushCommand({ dryRun: true });

    // Local file should NOT be created in dry-run mode
    expect(existsSync(join(env.local, "CLAUDE.md"))).toBe(false);
  });
});

// ── status ────────────────────────────────────────────────────────────────

describe("statusCommand", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = setupEnv();
    vi.resetModules();
    const config = await import("../config.js");
    config.setSyncRepoPath(env.repo);
    writeConfig(env.repo, env.local);
  });

  afterEach(() => {
    rmSync(env.repo, { recursive: true, force: true });
    rmSync(env.local, { recursive: true, force: true });
    rmSync(env.projectDir, { recursive: true, force: true });
  });

  it("statusCommand_identicalFiles_reportsIdentical", async () => {
    const { statusCommand } = await import("../commands/status.js");

    const content = "same\n";
    writeFileSync(join(env.local, "CLAUDE.md"), content);
    const dest = repoPath(env.repo, "global", "CLAUDE.md");
    mkdirSync(join(env.repo, "configs", FAKE_HOST, "global"), { recursive: true });
    writeFileSync(dest, content);

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((msg: string) => logs.push(msg ?? ""));

    statusCommand({});

    vi.restoreAllMocks();
    expect(logs.some((l) => l.includes("="))).toBe(true);
  });

  it("statusCommand_modifiedFiles_reportsModified", async () => {
    const { statusCommand } = await import("../commands/status.js");

    writeFileSync(join(env.local, "CLAUDE.md"), "local version\n");
    const dest = repoPath(env.repo, "global", "CLAUDE.md");
    mkdirSync(join(env.repo, "configs", FAKE_HOST, "global"), { recursive: true });
    writeFileSync(dest, "repo version\n");

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((msg: string) => logs.push(msg ?? ""));

    statusCommand({});

    vi.restoreAllMocks();
    expect(logs.some((l) => l.includes("[M]"))).toBe(true);
  });

  it("statusCommand_localOnlyFile_reportsLocalOnly", async () => {
    const { statusCommand } = await import("../commands/status.js");

    writeFileSync(join(env.local, "CLAUDE.md"), "local only\n");
    // Do NOT write to repo

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((msg: string) => logs.push(msg ?? ""));

    statusCommand({});

    vi.restoreAllMocks();
    expect(logs.some((l) => l.includes("[L]"))).toBe(true);
  });
});

// ── add-project / remove-project ──────────────────────────────────────────

describe("addProjectCommand", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = setupEnv();
    vi.resetModules();
    const config = await import("../config.js");
    config.setSyncRepoPath(env.repo);
    writeConfig(env.repo, env.local);
  });

  afterEach(() => {
    rmSync(env.repo, { recursive: true, force: true });
    rmSync(env.local, { recursive: true, force: true });
    rmSync(env.projectDir, { recursive: true, force: true });
  });

  it("addProjectCommand_newProject_addsToConfig", async () => {
    const { addProjectCommand } = await import("../commands/add-project.js");

    addProjectCommand("my-app", env.projectDir);

    const { loadConfig } = await import("../config.js");
    const config = loadConfig();
    expect(config.machines[FAKE_HOST].projects["my-app"]).toBe(env.projectDir);
  });

  it("addProjectCommand_invalidName_exitsWithError", async () => {
    const { addProjectCommand } = await import("../commands/add-project.js");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    addProjectCommand("../bad/name", env.projectDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("addProjectCommand_nameWithSlash_exitsWithError", async () => {
    const { addProjectCommand } = await import("../commands/add-project.js");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    addProjectCommand("foo/bar", env.projectDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});

describe("removeProjectCommand", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = setupEnv();
    vi.resetModules();
    const config = await import("../config.js");
    config.setSyncRepoPath(env.repo);
    // Pre-register a project
    writeConfig(env.repo, env.local, { "my-app": env.projectDir });
  });

  afterEach(() => {
    rmSync(env.repo, { recursive: true, force: true });
    rmSync(env.local, { recursive: true, force: true });
    rmSync(env.projectDir, { recursive: true, force: true });
  });

  it("removeProjectCommand_existingProject_removesFromConfig", async () => {
    // Mock readline to auto-answer "n" so we don't delete the repo dir
    vi.doMock("../prompt.js", () => ({ ask: async () => "n" }));

    const { removeProjectCommand } = await import("../commands/remove-project.js");

    await removeProjectCommand("my-app");

    const { loadConfig } = await import("../config.js");
    const config = loadConfig();
    expect(config.machines[FAKE_HOST].projects["my-app"]).toBeUndefined();
  });

  it("removeProjectCommand_missingProject_exitsWithError", async () => {
    const { removeProjectCommand } = await import("../commands/remove-project.js");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await removeProjectCommand("nonexistent");
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});

// ── config command ────────────────────────────────────────────────────────

describe("configSetRepoCommand", () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = mkdtempSync(join(tmpdir(), "cc-home-"));
    vi.resetModules();
    // Override homedir so ~/.cc-config-sync.json lands in our temp dir
    vi.doMock("node:os", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:os")>();
      return { ...actual, homedir: () => tmpHome, hostname: () => FAKE_HOST };
    });
  });

  afterEach(() => {
    rmSync(tmpHome, { recursive: true, force: true });
  });

  it("configSetRepoCommand_validPath_savesConfig", async () => {
    const { configSetRepoCommand } = await import("../commands/config.js");
    const { getUserConfigRepo } = await import("../user-config.js");

    // Use a distinct subdir as the repo path (not tmpHome itself)
    const repoPath = mkdtempSync(join(tmpdir(), "cc-repo-arg-"));
    try {
      configSetRepoCommand(repoPath);
      expect(getUserConfigRepo()).toBe(repoPath);
    } finally {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });

  it("configSetRepoCommand_nonexistentPath_savesWithWarning", async () => {
    const { configSetRepoCommand } = await import("../commands/config.js");
    const { getUserConfigRepo } = await import("../user-config.js");

    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((msg: string) => errors.push(msg ?? ""));

    const fakePath = join(tmpHome, "nonexistent-repo");
    configSetRepoCommand(fakePath);

    vi.restoreAllMocks();
    expect(errors.some((l) => l.toLowerCase().includes("warning"))).toBe(true);
    expect(getUserConfigRepo()).toBe(fakePath);
  });

  it("configShowCommand_noConfig_printsHint", async () => {
    const { configShowCommand } = await import("../commands/config.js");

    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((msg: string) => errors.push(msg ?? ""));

    configShowCommand();

    vi.restoreAllMocks();
    expect(errors.some((l) => l.includes("config set-repo"))).toBe(true);
  });

  it("configShowCommand_withConfig_printsRepo", async () => {
    const { configSetRepoCommand, configShowCommand } = await import("../commands/config.js");

    configSetRepoCommand(tmpHome);

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((msg: string) => logs.push(msg ?? ""));

    configShowCommand();

    vi.restoreAllMocks();
    expect(logs.some((l) => l.includes(tmpHome))).toBe(true);
  });
});

// ── rename-project ────────────────────────────────────────────────────────

describe("renameProjectCommand", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = setupEnv();
    vi.resetModules();
    const config = await import("../config.js");
    config.setSyncRepoPath(env.repo);
    writeConfig(env.repo, env.local, { "old-app": env.projectDir });
  });

  afterEach(() => {
    rmSync(env.repo, { recursive: true, force: true });
    rmSync(env.local, { recursive: true, force: true });
    rmSync(env.projectDir, { recursive: true, force: true });
  });

  it("renameProjectCommand_validNames_updatesConfig", async () => {
    const { renameProjectCommand } = await import("../commands/rename-project.js");

    renameProjectCommand("old-app", "new-app");

    const { loadConfig } = await import("../config.js");
    const config = loadConfig();
    expect(config.machines[FAKE_HOST].projects["old-app"]).toBeUndefined();
    expect(config.machines[FAKE_HOST].projects["new-app"]).toBe(env.projectDir);
  });

  it("renameProjectCommand_validNames_renamesRepoDirectory", async () => {
    const { renameProjectCommand } = await import("../commands/rename-project.js");

    // Create the old project directory in the repo
    const oldDir = join(env.repo, "configs", FAKE_HOST, "projects", "old-app");
    mkdirSync(oldDir, { recursive: true });
    writeFileSync(join(oldDir, "CLAUDE.md"), "# old\n");

    renameProjectCommand("old-app", "new-app");

    const newDir = join(env.repo, "configs", FAKE_HOST, "projects", "new-app");
    expect(existsSync(oldDir)).toBe(false);
    expect(existsSync(newDir)).toBe(true);
    expect(readFileSync(join(newDir, "CLAUDE.md"), "utf-8")).toBe("# old\n");
  });

  it("renameProjectCommand_invalidNewName_exitsWithError", async () => {
    const { renameProjectCommand } = await import("../commands/rename-project.js");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    renameProjectCommand("old-app", "../bad");
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("renameProjectCommand_newNameAlreadyExists_exitsWithError", async () => {
    const { loadConfig, saveConfig } = await import("../config.js");
    const config = loadConfig();
    // Register new-app so it already exists
    config.machines[FAKE_HOST].projects["new-app"] = "/some/other/path";
    saveConfig(config);

    const { renameProjectCommand } = await import("../commands/rename-project.js");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    renameProjectCommand("old-app", "new-app");
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});

// ── isConfigSubcommand (preAction guard) ──────────────────────────────────
// Import from cli-utils.ts — avoids triggering program.parse() that lives in cli.ts

describe("isConfigSubcommand", () => {
  it("isConfigSubcommand_configCommand_returnsTrue", async () => {
    const { Command } = await import("commander");
    const { isConfigSubcommand } = await import("../cli-utils.js");

    const root = new Command("cc-config-sync");
    const config = new Command("config");
    root.addCommand(config);

    expect(isConfigSubcommand(config)).toBe(true);
  });

  it("isConfigSubcommand_setRepoSubcommand_returnsTrue", async () => {
    const { Command } = await import("commander");
    const { isConfigSubcommand } = await import("../cli-utils.js");

    const root = new Command("cc-config-sync");
    const config = new Command("config");
    const setRepo = new Command("set-repo");
    config.addCommand(setRepo);
    root.addCommand(config);

    expect(isConfigSubcommand(setRepo)).toBe(true);
  });

  it("isConfigSubcommand_pullCommand_returnsFalse", async () => {
    const { Command } = await import("commander");
    const { isConfigSubcommand } = await import("../cli-utils.js");

    const root = new Command("cc-config-sync");
    const pull = new Command("pull");
    root.addCommand(pull);

    expect(isConfigSubcommand(pull)).toBe(false);
  });

  it("isConfigSubcommand_rootCommand_returnsFalse", async () => {
    const { Command } = await import("commander");
    const { isConfigSubcommand } = await import("../cli-utils.js");

    const root = new Command("cc-config-sync");

    expect(isConfigSubcommand(root)).toBe(false);
  });
});

// ── CLI subprocess integration (preAction guard end-to-end) ───────────────

/** Build a clean env: inherit process.env, set HOME to an isolated tmpdir,
 *  and remove CLAUDE_SYNC_REPO so no ambient config leaks into the subprocess. */
function isolatedEnv(tmpHome: string): NodeJS.ProcessEnv {
  // Destructure to omit CLAUDE_SYNC_REPO — avoids leaking any user-set repo path
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { CLAUDE_SYNC_REPO: _omit, ...rest } = process.env;
  return { ...rest, HOME: tmpHome };
}

describe("CLI preAction guard (subprocess)", () => {
  let tmpHome: string;
  const distCli = join(process.cwd(), "dist", "cli.js");

  beforeEach(() => {
    tmpHome = mkdtempSync(join(tmpdir(), "cc-home-"));
  });

  afterEach(() => {
    rmSync(tmpHome, { recursive: true, force: true });
  });

  it("configSetRepo_noRepoConfigured_exitCode0", () => {
    // Runs the built binary — requires `npm run build` to have been run.
    // Skips gracefully if dist/cli.js is missing (e.g. fresh checkout before build).
    if (!existsSync(distCli)) return;

    const repoArg = mkdtempSync(join(tmpdir(), "cc-repo-sub-"));
    try {
      const result = spawnSync("node", [distCli, "config", "set-repo", repoArg], {
        env: isolatedEnv(tmpHome),
        encoding: "utf-8",
      });

      // Must not exit with the "repo required" error (code 1 from preAction)
      expect(result.status).toBe(0);
      expect(result.stderr).not.toContain("sync repo path required");
    } finally {
      rmSync(repoArg, { recursive: true, force: true });
    }
  });

  it("configShow_noRepoConfigured_exitCode0", () => {
    if (!existsSync(distCli)) return;

    const result = spawnSync("node", [distCli, "config", "show"], {
      env: isolatedEnv(tmpHome),
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("sync repo path required");
  });

  it("pull_noRepoConfigured_exitCode1WithHint", () => {
    if (!existsSync(distCli)) return;

    const result = spawnSync("node", [distCli, "pull"], {
      env: isolatedEnv(tmpHome),
      encoding: "utf-8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("config set-repo");
  });
});
