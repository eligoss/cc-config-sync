# Non-Interactive Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `--non-interactive` global flag and `CI` env var detection so all CLI commands can run without interactive prompts.

**Architecture:** A global `--non-interactive` option on the root Commander program, with an `isNonInteractive()` helper in `cli-utils.ts`. Each interactive command checks this flag and either skips prompts (using flag-provided values or safe defaults) or fails fast with a clear error if required values are missing.

**Tech Stack:** TypeScript, Commander.js, Vitest

**Spec:** `docs/superpowers/specs/2026-03-25-non-interactive-mode-design.md`

---

## File Map

| File                              | Action | Responsibility                                                                             |
| --------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `src/cli-utils.ts`                | Modify | Add `isNonInteractive()` helper                                                            |
| `src/cli.ts`                      | Modify | Add global `--non-interactive` flag; add new flags to `init` and `remove-project` commands |
| `src/commands/push.ts`            | Modify | Check non-interactive mode to skip per-file prompts                                        |
| `src/commands/init.ts`            | Modify | Accept options object with new flags; skip prompts in non-interactive mode                 |
| `src/commands/remove-project.ts`  | Modify | Accept options; check non-interactive + `--delete-repo-dir`                                |
| `src/commands/clean-backups.ts`   | Modify | Accept options; check non-interactive to skip prompt                                       |
| `package.json`                    | Modify | Bump version to `1.1.0`                                                                    |
| `README.md`                       | Modify | Document non-interactive mode                                                              |
| `CLAUDE.md`                       | Modify | Update CLI commands table                                                                  |
| `src/__tests__/cli-utils.test.ts` | Create | Tests for `isNonInteractive()`                                                             |
| `src/__tests__/commands.test.ts`  | Modify | Add non-interactive tests for push, init, remove-project, clean-backups                    |

---

### Task 1: Add `isNonInteractive()` helper with tests

**Files:**

- Modify: `src/cli-utils.ts`
- Create: `src/__tests__/cli-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/cli-utils.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// isConfigSubcommand tests already exist in commands.test.ts — only test isNonInteractive here

describe("isNonInteractive", () => {
  const originalCI = process.env.CI;

  afterEach(() => {
    if (originalCI === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCI;
    }
  });

  it("returns false when flag is false and CI is not set", async () => {
    delete process.env.CI;
    const { isNonInteractive } = await import("../cli-utils.js");
    expect(isNonInteractive({ nonInteractive: false })).toBe(false);
  });

  it("returns false when options is empty and CI is not set", async () => {
    delete process.env.CI;
    const { isNonInteractive } = await import("../cli-utils.js");
    expect(isNonInteractive({})).toBe(false);
  });

  it("returns true when flag is true", async () => {
    delete process.env.CI;
    const { isNonInteractive } = await import("../cli-utils.js");
    expect(isNonInteractive({ nonInteractive: true })).toBe(true);
  });

  it("returns true when CI=true", async () => {
    process.env.CI = "true";
    const { isNonInteractive } = await import("../cli-utils.js");
    expect(isNonInteractive({})).toBe(true);
  });

  it("returns true when CI=1", async () => {
    process.env.CI = "1";
    const { isNonInteractive } = await import("../cli-utils.js");
    expect(isNonInteractive({})).toBe(true);
  });

  it("returns true when both flag and CI are set", async () => {
    process.env.CI = "true";
    const { isNonInteractive } = await import("../cli-utils.js");
    expect(isNonInteractive({ nonInteractive: true })).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/cli-utils.test.ts`
Expected: FAIL — `isNonInteractive` is not exported from `../cli-utils.js`

- [ ] **Step 3: Implement `isNonInteractive` in `cli-utils.ts`**

Add to the end of `src/cli-utils.ts`:

```typescript
/**
 * Returns true if the CLI is running in non-interactive mode.
 * Triggered by the --non-interactive flag or a truthy CI environment variable.
 */
export function isNonInteractive(options: { nonInteractive?: boolean }): boolean {
  return options.nonInteractive === true || !!process.env.CI;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/cli-utils.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli-utils.ts src/__tests__/cli-utils.test.ts
git commit -m "feat(cli): add isNonInteractive() helper with CI env var detection"
```

---

### Task 2: Add global `--non-interactive` flag to Commander program

**Files:**

- Modify: `src/cli.ts`

- [ ] **Step 1: Add the global option to the root program**

In `src/cli.ts`, after line 23 (the `--repo` option), add:

```typescript
  .option("--non-interactive", "Run without interactive prompts (also enabled by CI env var)")
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors)

- [ ] **Step 3: Commit**

```bash
git add src/cli.ts
git commit -m "feat(cli): add --non-interactive global option to Commander program"
```

---

### Task 3: Update `push` command for non-interactive mode

**Files:**

- Modify: `src/commands/push.ts`
- Modify: `src/__tests__/commands.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the `pushCommand` describe block in `src/__tests__/commands.test.ts`:

```typescript
it("pushCommand_nonInteractive_copiesWithoutPrompting", async () => {
  const { pushCommand } = await import("../commands/push.js");

  const src = repoPath(env.repo, "global", "CLAUDE.md");
  mkdirSync(join(env.repo, "configs", FAKE_HOST, "global"), { recursive: true });
  writeFileSync(src, "# from repo\n");

  // nonInteractive should apply all changes without prompting, like --yes
  await pushCommand({ nonInteractive: true });

  const dest = join(env.local, "CLAUDE.md");
  expect(existsSync(dest)).toBe(true);
  expect(readFileSync(dest, "utf-8")).toBe("# from repo\n");
});

it("pushCommand_nonInteractive_partialFailure_exits1", async () => {
  const { pushCommand } = await import("../commands/push.js");
  const { copyFileWithDir } = await import("../files.js");

  // Set up two files in repo
  mkdirSync(join(env.repo, "configs", FAKE_HOST, "global"), { recursive: true });
  writeFileSync(repoPath(env.repo, "global", "CLAUDE.md"), "# file1\n");
  writeFileSync(repoPath(env.repo, "global", "settings.json"), '{"key": "val"}\n');

  // Mock copyFileWithDir to fail on the first call
  const originalCopy = copyFileWithDir;
  let callCount = 0;
  vi.spyOn(await import("../files.js"), "copyFileWithDir").mockImplementation((...args) => {
    callCount++;
    if (callCount === 1) throw new Error("Disk full");
    return originalCopy(...args);
  });

  const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

  await pushCommand({ nonInteractive: true });

  expect(exitSpy).toHaveBeenCalledWith(1);
  exitSpy.mockRestore();
});

it("pushCommand_nonInteractive_dryRun_doesNotCopyFiles", async () => {
  const { pushCommand } = await import("../commands/push.js");

  const src = repoPath(env.repo, "global", "CLAUDE.md");
  mkdirSync(join(env.repo, "configs", FAKE_HOST, "global"), { recursive: true });
  writeFileSync(src, "# repo content\n");

  await pushCommand({ nonInteractive: true, dryRun: true });

  expect(existsSync(join(env.local, "CLAUDE.md"))).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/commands.test.ts -t "pushCommand_nonInteractive"`
Expected: FAIL — `nonInteractive` not in `PushOptions`

- [ ] **Step 3: Implement non-interactive mode in push**

In `src/commands/push.ts`:

1. Add import at top:

```typescript
import { isNonInteractive } from "../cli-utils.js";
```

2. Add `nonInteractive` to the `PushOptions` interface:

```typescript
interface PushOptions {
  project?: string;
  globalOnly?: boolean;
  yes?: boolean;
  dryRun?: boolean;
  backup?: boolean;
  nonInteractive?: boolean;
}
```

3. Change line 60 from:

```typescript
let applyAll = options.yes ?? false;
```

to:

```typescript
let applyAll = (options.yes ?? false) || isNonInteractive(options);
```

4. Add error tracking and try/catch around the copy operation. Add `let hasErrors = false;` after `let applyAll`. Then wrap the backup+copy block (lines 104-119) in a try/catch:

```typescript
try {
  if (backupsEnabled && fileExists(file.localPath)) {
    assertSafeBackupLabel(file.label);
    if (!gitignoreEnsured) {
      ensureBackupsGitignored(repoRoot);
      gitignoreEnsured = true;
    }
    backupFileToRepo(file, machine.name, repoRoot, backupDate);
    console.log(`  backup → backups/${backupDate}/${machine.name}/${file.label}`);
  }

  copyFileWithDir(file.repoPath, file.localPath);
  if (file.localPath.endsWith(".sh")) {
    ensureExecutable(file.localPath);
  }
  console.log(`  push  ${file.label}`);
  pushed++;
} catch (err) {
  console.error(`  error  ${file.label}: ${err}`);
  hasErrors = true;
}
```

5. At the end of the function, after the summary log, add:

```typescript
if (hasErrors) {
  process.exit(1);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/commands.test.ts -t "pushCommand"`
Expected: All pushCommand tests PASS (existing + new)

- [ ] **Step 5: Commit**

```bash
git add src/commands/push.ts src/__tests__/commands.test.ts
git commit -m "feat(push): skip prompts in non-interactive mode"
```

---

### Task 4: Update `clean-backups` command for non-interactive mode

**Files:**

- Modify: `src/commands/clean-backups.ts`
- Modify: `src/__tests__/commands.test.ts`

- [ ] **Step 1: Write the failing test**

Add a new describe block in `src/__tests__/commands.test.ts`:

```typescript
describe("cleanBackupsCommand — non-interactive", () => {
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

  it("cleanBackupsCommand_nonInteractive_deletesWithoutPrompting", async () => {
    // Create a backup folder
    const backupDir = join(env.repo, "backups", "2026-01-01");
    mkdirSync(backupDir, { recursive: true });
    writeFileSync(join(backupDir, "file.txt"), "backup content");

    const { cleanBackupsCommand } = await import("../commands/clean-backups.js");

    await cleanBackupsCommand({ nonInteractive: true });

    expect(existsSync(backupDir)).toBe(false);
  });

  it("cleanBackupsCommand_noOptions_stillPromptsInInteractiveMode", async () => {
    // Create a backup folder
    const backupDir = join(env.repo, "backups", "2026-01-01");
    mkdirSync(backupDir, { recursive: true });
    writeFileSync(join(backupDir, "file.txt"), "backup content");

    // Mock prompt to answer "n"
    vi.doMock("../prompt.js", () => ({ ask: async () => "n" }));

    const { cleanBackupsCommand } = await import("../commands/clean-backups.js");

    await cleanBackupsCommand({});

    // Backup should still exist because we answered "n"
    expect(existsSync(backupDir)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/commands.test.ts -t "cleanBackupsCommand"`
Expected: FAIL — `cleanBackupsCommand` doesn't accept options

- [ ] **Step 3: Implement non-interactive mode in clean-backups**

In `src/commands/clean-backups.ts`:

1. Add import:

```typescript
import { isNonInteractive } from "../cli-utils.js";
```

2. Add options interface and update function signature from:

```typescript
export async function cleanBackupsCommand(): Promise<void> {
```

to:

```typescript
interface CleanBackupsOptions {
  nonInteractive?: boolean;
}

export async function cleanBackupsCommand(options: CleanBackupsOptions = {}): Promise<void> {
```

3. Replace the prompt block (lines 43-47) from:

```typescript
const answer = await ask(`\nDelete all backups? [y/N] `);
if (answer !== "y" && answer !== "yes") {
  console.log("Cancelled.");
  return;
}
```

to:

```typescript
if (!isNonInteractive(options)) {
  const answer = await ask(`\nDelete all backups? [y/N] `);
  if (answer !== "y" && answer !== "yes") {
    console.log("Cancelled.");
    return;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/commands.test.ts -t "cleanBackupsCommand"`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/clean-backups.ts src/__tests__/commands.test.ts
git commit -m "feat(clean-backups): skip confirmation in non-interactive mode"
```

---

### Task 5: Update `remove-project` command for non-interactive mode

**Files:**

- Modify: `src/commands/remove-project.ts`
- Modify: `src/cli.ts`
- Modify: `src/__tests__/commands.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the `removeProjectCommand` describe block in `src/__tests__/commands.test.ts`:

```typescript
it("removeProjectCommand_nonInteractive_skipsPromptKeepsDir", async () => {
  const { removeProjectCommand } = await import("../commands/remove-project.js");

  // Create the repo project dir so the prompt would normally fire
  const repoProjectDir = join(env.repo, "configs", FAKE_HOST, "projects", "my-app");
  mkdirSync(repoProjectDir, { recursive: true });
  writeFileSync(join(repoProjectDir, "CLAUDE.md"), "# test");

  await removeProjectCommand("my-app", { nonInteractive: true });

  const { loadConfig } = await import("../config.js");
  const config = loadConfig();
  expect(config.machines[FAKE_HOST].projects["my-app"]).toBeUndefined();
  // Repo dir should still exist (safe default)
  expect(existsSync(repoProjectDir)).toBe(true);
});

it("removeProjectCommand_nonInteractive_deleteRepoDir_deletesDir", async () => {
  const { removeProjectCommand } = await import("../commands/remove-project.js");

  const repoProjectDir = join(env.repo, "configs", FAKE_HOST, "projects", "my-app");
  mkdirSync(repoProjectDir, { recursive: true });
  writeFileSync(join(repoProjectDir, "CLAUDE.md"), "# test");

  await removeProjectCommand("my-app", { nonInteractive: true, deleteRepoDir: true });

  const { loadConfig } = await import("../config.js");
  const config = loadConfig();
  expect(config.machines[FAKE_HOST].projects["my-app"]).toBeUndefined();
  expect(existsSync(repoProjectDir)).toBe(false);
});

it("removeProjectCommand_nonInteractive_deleteRepoDir_missingDir_silent", async () => {
  const { removeProjectCommand } = await import("../commands/remove-project.js");

  // Don't create repo dir — it doesn't exist
  await removeProjectCommand("my-app", { nonInteractive: true, deleteRepoDir: true });

  const { loadConfig } = await import("../config.js");
  const config = loadConfig();
  expect(config.machines[FAKE_HOST].projects["my-app"]).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/commands.test.ts -t "removeProjectCommand_nonInteractive"`
Expected: FAIL — `removeProjectCommand` doesn't accept options

- [ ] **Step 3: Implement non-interactive mode in remove-project**

In `src/commands/remove-project.ts`:

1. Add import:

```typescript
import { isNonInteractive } from "../cli-utils.js";
```

2. Add options interface and update function signature from:

```typescript
export async function removeProjectCommand(name: string): Promise<void> {
```

to:

```typescript
interface RemoveProjectOptions {
  nonInteractive?: boolean;
  deleteRepoDir?: boolean;
}

export async function removeProjectCommand(name: string, options: RemoveProjectOptions = {}): Promise<void> {
```

3. Replace the prompt block (lines 33-43) from:

```typescript
// Offer to delete the corresponding directory in the sync repo
const repoProjectDir = join(getConfigsDir(), machineName, "projects", name);
if (existsSync(repoProjectDir)) {
  const answer = await ask(`\nAlso delete repo directory ${repoProjectDir}? [y/N] `);
  if (answer === "y" || answer === "yes") {
    rmSync(repoProjectDir, { recursive: true });
    console.log(`Deleted ${repoProjectDir}`);
  } else {
    console.log("Repo directory kept.");
  }
}
```

to:

```typescript
// Offer to delete the corresponding directory in the sync repo
const repoProjectDir = join(getConfigsDir(), machineName, "projects", name);
if (existsSync(repoProjectDir)) {
  if (isNonInteractive(options)) {
    if (options.deleteRepoDir) {
      rmSync(repoProjectDir, { recursive: true });
      console.log(`Deleted ${repoProjectDir}`);
    } else {
      console.log("Repo directory kept (use --delete-repo-dir to remove).");
    }
  } else {
    const answer = await ask(`\nAlso delete repo directory ${repoProjectDir}? [y/N] `);
    if (answer === "y" || answer === "yes") {
      rmSync(repoProjectDir, { recursive: true });
      console.log(`Deleted ${repoProjectDir}`);
    } else {
      console.log("Repo directory kept.");
    }
  }
}
```

4. In `src/cli.ts`, add `--delete-repo-dir` option to the remove-project command. Change lines 80-84 from:

```typescript
program
  .command("remove-project")
  .description("Remove a project from tracking")
  .argument("<name>", "Project name")
  .action(removeProjectCommand);
```

to:

```typescript
program
  .command("remove-project")
  .description("Remove a project from tracking")
  .argument("<name>", "Project name")
  .option("--delete-repo-dir", "Also delete the project directory in the sync repo")
  .action(removeProjectCommand);
```

5. Update the existing test that mocks prompt to also pass options. Change:

```typescript
  it("removeProjectCommand_existingProject_removesFromConfig", async () => {
    // Mock readline to auto-answer "n" so we don't delete the repo dir
    vi.doMock("../prompt.js", () => ({ ask: async () => "n" }));

    const { removeProjectCommand } = await import("../commands/remove-project.js");

    await removeProjectCommand("my-app");
```

to:

```typescript
  it("removeProjectCommand_existingProject_removesFromConfig", async () => {
    // Mock readline to auto-answer "n" so we don't delete the repo dir
    vi.doMock("../prompt.js", () => ({ ask: async () => "n" }));

    const { removeProjectCommand } = await import("../commands/remove-project.js");

    await removeProjectCommand("my-app", {});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/commands.test.ts -t "removeProjectCommand"`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/remove-project.ts src/cli.ts src/__tests__/commands.test.ts
git commit -m "feat(remove-project): add --delete-repo-dir flag and non-interactive mode"
```

---

### Task 6: Update `init` command for non-interactive mode

**Files:**

- Modify: `src/commands/init.ts`
- Modify: `src/cli.ts`
- Modify: `src/__tests__/commands.test.ts`

- [ ] **Step 1: Write the failing tests**

Add a new describe block in `src/__tests__/commands.test.ts`:

```typescript
describe("initCommand — non-interactive", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = setupEnv();
    vi.resetModules();
    const config = await import("../config.js");
    config.setSyncRepoPath(env.repo);
    // Start with empty config (no machines)
    writeFileSync(
      join(env.repo, "sync.config.json"),
      JSON.stringify({ machines: {} }, null, 2) + "\n",
    );
  });

  afterEach(() => {
    rmSync(env.repo, { recursive: true, force: true });
    rmSync(env.local, { recursive: true, force: true });
    rmSync(env.projectDir, { recursive: true, force: true });
  });

  it("initCommand_nonInteractive_missingMachineName_exits1", async () => {
    const { initCommand } = await import("../commands/init.js");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await initCommand({ nonInteractive: true });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("initCommand_nonInteractive_withMachineName_createsConfig", async () => {
    const { initCommand } = await import("../commands/init.js");

    await initCommand({
      nonInteractive: true,
      machineName: "my-machine",
      globalPath: env.local,
    });

    const { loadConfig } = await import("../config.js");
    const config = loadConfig();
    expect(config.machines["my-machine"]).toBeDefined();
    expect(config.machines["my-machine"].globalConfigPath).toBe(env.local);
  });

  it("initCommand_nonInteractive_defaultGlobalPath_usesHomeClaude", async () => {
    const { initCommand } = await import("../commands/init.js");
    const { homedir } = await import("node:os");

    await initCommand({
      nonInteractive: true,
      machineName: "my-machine",
    });

    const { loadConfig } = await import("../config.js");
    const config = loadConfig();
    expect(config.machines["my-machine"].globalConfigPath).toBe(`${homedir()}/.claude`);
  });

  it("initCommand_nonInteractive_withProjects_parsesNameColonPath", async () => {
    const { initCommand } = await import("../commands/init.js");

    await initCommand({
      nonInteractive: true,
      machineName: "my-machine",
      globalPath: env.local,
      project: [`test-proj:${env.projectDir}`],
    });

    const { loadConfig } = await import("../config.js");
    const config = loadConfig();
    expect(config.machines["my-machine"].projects["test-proj"]).toBeDefined();
  });

  it("initCommand_nonInteractive_malformedProject_exits1", async () => {
    const { initCommand } = await import("../commands/init.js");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await initCommand({
      nonInteractive: true,
      machineName: "my-machine",
      project: ["no-colon-here"],
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("initCommand_nonInteractive_existingConfig_preservesExistingValues", async () => {
    // First create an existing config
    const { loadConfig, saveConfig } = await import("../config.js");
    const config = loadConfig();
    config.machines["my-machine"] = {
      globalConfigPath: "/custom/path",
      projects: { "existing-proj": "/some/path" },
    };
    saveConfig(config);

    const { initCommand } = await import("../commands/init.js");

    // Update without providing globalPath — should preserve /custom/path
    await initCommand({
      nonInteractive: true,
      machineName: "my-machine",
    });

    const updatedConfig = loadConfig();
    expect(updatedConfig.machines["my-machine"].globalConfigPath).toBe("/custom/path");
    expect(updatedConfig.machines["my-machine"].projects["existing-proj"]).toBe("/some/path");
  });

  it("initCommand_nonInteractive_backupDisabled", async () => {
    const { initCommand } = await import("../commands/init.js");

    await initCommand({
      nonInteractive: true,
      machineName: "my-machine",
      globalPath: env.local,
      backup: false,
    });

    const { getBackupsEnabled } = await import("../user-config.js");
    expect(getBackupsEnabled()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/commands.test.ts -t "initCommand"`
Expected: FAIL — `initCommand` doesn't accept options

- [ ] **Step 3: Implement non-interactive mode in init**

Replace the entire `src/commands/init.ts` with:

```typescript
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { hostname, homedir } from "node:os";
import { getMachineName } from "../machine.js";
import { loadConfig, saveConfig } from "../config.js";
import { setBackupsEnabled, getBackupsEnabled } from "../user-config.js";
import { isNonInteractive } from "../cli-utils.js";

// init uses its own ask() because it supports optional defaultValue display,
// which differs from the shared ask() in prompt.ts
function ask(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

export interface InitOptions {
  nonInteractive?: boolean;
  machineName?: string;
  globalPath?: string;
  backup?: boolean;
  project?: string[];
}

/**
 * Parse a "name:path" string, splitting on the first colon only.
 * Returns [name, path] or null if the format is invalid.
 */
function parseProjectArg(value: string): [string, string] | null {
  const colonIndex = value.indexOf(":");
  if (colonIndex === -1) return null;
  const name = value.slice(0, colonIndex);
  const path = value.slice(colonIndex + 1);
  if (!name || !path) return null;
  return [name, resolve(path)];
}

export async function initCommand(options: InitOptions = {}): Promise<void> {
  const config = loadConfig();
  const systemHostname = hostname();

  if (isNonInteractive(options)) {
    // --- Non-interactive mode ---
    if (!options.machineName) {
      console.error("Error: --machine-name is required in non-interactive mode");
      process.exit(1);
    }

    const machineName = options.machineName;
    const existingConfig = config.machines[machineName];

    // Resolve values: explicit flag > existing config > default
    const globalConfigPath =
      options.globalPath ?? existingConfig?.globalConfigPath ?? `${homedir()}/.claude`;

    if (!existsSync(globalConfigPath)) {
      console.log(`Warning: ${globalConfigPath} does not exist.`);
    }

    // Parse projects from --project flags
    const projects: Record<string, string> = { ...(existingConfig?.projects || {}) };
    if (options.project) {
      for (const projectArg of options.project) {
        const parsed = parseProjectArg(projectArg);
        if (!parsed) {
          console.error(`Error: Invalid --project format "${projectArg}", expected name:path`);
          process.exit(1);
        }
        const [name, path] = parsed;
        if (!existsSync(path)) {
          console.log(`Warning: ${path} does not exist.`);
        }
        projects[name] = path;
      }
    }

    // Resolve backup setting: explicit flag > existing setting > default (true)
    if (options.backup !== undefined) {
      setBackupsEnabled(options.backup);
    } else if (!existingConfig) {
      setBackupsEnabled(true);
    }
    // If existingConfig exists and no explicit flag, preserve existing backup setting

    config.machines[machineName] = { globalConfigPath, projects };
    saveConfig(config);

    const backupsEnabled = getBackupsEnabled();
    console.log(`Saved configuration for "${machineName}" to sync.config.json`);
    console.log(`  Global: ${globalConfigPath}`);
    console.log(`  Projects: ${Object.keys(projects).length}`);
    console.log(`  Backups: ${backupsEnabled ? "enabled" : "disabled"}`);
    return;
  }

  // --- Interactive mode (original behavior) ---
  const defaultName = getMachineName();

  console.log("Claude Config Sync — Machine Setup\n");

  const machineName = await ask("Machine name", defaultName);

  if (machineName !== systemHostname) {
    console.log(
      `Warning: Your system hostname is '${systemHostname}'. Using a different name means` +
        ` other commands won't find this machine unless you rename it.`,
    );
  }

  const existingConfig = config.machines[machineName];
  if (existingConfig) {
    console.log(`\nExisting config found for "${machineName}".`);
    const update = await ask("Update it? [y/N]");
    if (update.toLowerCase() !== "y" && update.toLowerCase() !== "yes") {
      console.log("Aborted.");
      return;
    }
  }

  const defaultGlobal = existingConfig?.globalConfigPath || `${homedir()}/.claude`;
  const globalConfigPath = await ask("Global config path (~/.claude)", defaultGlobal);

  if (!existsSync(globalConfigPath)) {
    console.log(`Warning: ${globalConfigPath} does not exist.`);
  }

  const existingBackupsEnabled = getBackupsEnabled();
  const backupAnswer = await ask(
    "Back up local files before pushing?",
    existingBackupsEnabled ? "Y" : "n",
  );
  const backupsEnabled = backupAnswer.toLowerCase() !== "n" && backupAnswer.toLowerCase() !== "no";

  const projects: Record<string, string> = { ...(existingConfig?.projects || {}) };

  console.log("\nAdd projects to sync (leave name empty to finish):");

  if (Object.keys(projects).length > 0) {
    console.log("Current projects:");
    for (const [name, path] of Object.entries(projects)) {
      console.log(`  ${name}: ${path}`);
    }
    console.log();
  }

  while (true) {
    const name = await ask("Project name (empty to finish)");
    if (!name) break;

    const path = await ask(`  Path for "${name}"`);
    if (!path) continue;

    const resolved = resolve(path);
    if (!existsSync(resolved)) {
      console.log(`  Warning: ${resolved} does not exist.`);
    }
    projects[name] = resolved;
    console.log(`  Added: ${name} → ${resolved}`);
  }

  config.machines[machineName] = { globalConfigPath, projects };
  saveConfig(config);
  setBackupsEnabled(backupsEnabled);

  console.log(`\nSaved configuration for "${machineName}" to sync.config.json`);
  console.log(`  Global: ${globalConfigPath}`);
  console.log(`  Projects: ${Object.keys(projects).length}`);
  console.log(`  Backups: ${backupsEnabled ? "enabled" : "disabled"}`);
}
```

In `src/cli.ts`, update the `init` command definition (line 71) from:

```typescript
program.command("init").description("Interactive setup for current machine").action(initCommand);
```

to:

```typescript
program
  .command("init")
  .description("Interactive setup for current machine")
  .option("--machine-name <name>", "Machine identifier (required in non-interactive mode)")
  .option("--global-path <path>", "Path to global config directory (default: ~/.claude)")
  .option("--backup", "Enable backups on push (default)")
  .option("--no-backup", "Disable backups on push")
  .option(
    "--project <name:path>",
    "Add project to track (repeatable, format: name:path)",
    (val: string, acc: string[]) => [...acc, val],
    [] as string[],
  )
  .action(initCommand);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/commands.test.ts -t "initCommand"`
Expected: All PASS

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: All tests PASS (no regressions)

- [ ] **Step 6: Commit**

```bash
git add src/commands/init.ts src/cli.ts src/__tests__/commands.test.ts
git commit -m "feat(init): add non-interactive mode with --machine-name, --global-path, --project flags"
```

---

### Task 7: Wire Commander to pass `optsWithGlobals()` to commands

**Files:**

- Modify: `src/cli.ts`

Commander passes options to action handlers automatically, but `--non-interactive` is on the root program. We need to verify that each command's action handler receives it via `optsWithGlobals()`. Commander merges parent options into the action options automatically when using `.option()` on the root program. However, for commands that take positional arguments (like `remove-project <name>`), Commander passes arguments first, then options.

- [ ] **Step 1: Verify Commander's option passing behavior**

Check the current action wiring. Commands with positional args (`remove-project`, `add-project`, `rename-project`) receive args then options. Commands without positional args (`push`, `init`, `clean-backups`) receive just options.

The `removeProjectCommand(name, options)` signature matches Commander's `(arg, options)` pattern.
The `cleanBackupsCommand(options)` and `initCommand(options)` need Commander to pass options.

For `clean-backups`, Commander will pass the command options to the action. Since `clean-backups` has no `.option()` calls, Commander passes an empty options object. We need the global `--non-interactive` to be merged in.

Commander's `.action()` handler receives `(options, command)` for commands without arguments. The global options are available via `command.optsWithGlobals()`. We need to explicitly merge them.

Update `src/cli.ts` to wrap the action handlers that need global options. Change the clean-backups command from:

```typescript
program
  .command("clean-backups")
  .description("Delete dated backup folders from the repo backups/ directory")
  .action(cleanBackupsCommand);
```

to:

```typescript
program
  .command("clean-backups")
  .description("Delete dated backup folders from the repo backups/ directory")
  .action((_options, command) => cleanBackupsCommand(command.optsWithGlobals()));
```

For `push`, Commander passes the push-level options, but we also need `nonInteractive` from the root. Change:

```typescript
  .action(pushCommand);
```

to:

```typescript
  .action((_options, command) => pushCommand(command.optsWithGlobals()));
```

For `init`, same pattern. Change:

```typescript
  .action(initCommand);
```

to:

```typescript
  .action((_options, command) => initCommand(command.optsWithGlobals()));
```

For `remove-project`, Commander passes `(name, options, command)`. Change:

```typescript
  .action(removeProjectCommand);
```

to:

```typescript
  .action((name, _options, command) => removeProjectCommand(name, command.optsWithGlobals()));
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat(cli): wire optsWithGlobals() to pass --non-interactive to all commands"
```

---

### Task 8: Bump version to 1.1.0

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Bump version**

In `package.json`, change line 3 from:

```json
  "version": "1.0.0",
```

to:

```json
  "version": "1.1.0",
```

Note: `src/version.ts` reads from `package.json` at runtime, so no change needed there.

- [ ] **Step 2: Run version test**

Run: `npx vitest run src/__tests__/version.test.ts`
Expected: PASS (or update test if it asserts exact version string)

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 1.1.0"
```

---

### Task 9: Update documentation

**Files:**

- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add non-interactive mode section to README.md**

After the "Commands" section (after `### config show` block, before `## Configuration`), add:

````markdown
## Non-Interactive Mode

For use in CI/CD pipelines, scripts, and AI agents. Suppresses all interactive prompts.

```bash
# Via flag
cc-config-sync --non-interactive push
cc-config-sync --non-interactive init --machine-name my-machine --global-path ~/.claude

# Via CI environment variable (auto-detected)
CI=true cc-config-sync push
```
````

### Behavior by command

| Command          | Interactive (default)     | Non-interactive                                                   |
| ---------------- | ------------------------- | ----------------------------------------------------------------- |
| `push`           | Confirms each file change | Applies all changes                                               |
| `init`           | Prompts for all values    | Requires `--machine-name`; others use defaults or existing values |
| `remove-project` | Asks to delete repo dir   | Keeps repo dir (use `--delete-repo-dir` to delete)                |
| `clean-backups`  | Confirms before deleting  | Deletes without confirmation                                      |
| Others           | No prompts                | No change                                                         |

### Init flags (non-interactive)

| Flag                       | Required | Default        |
| -------------------------- | -------- | -------------- |
| `--machine-name <name>`    | Yes      | —              |
| `--global-path <path>`     | No       | `~/.claude`    |
| `--backup` / `--no-backup` | No       | `--backup`     |
| `--project <name:path>`    | No       | — (repeatable) |

````

- [ ] **Step 2: Update CLAUDE.md CLI commands table**

In `CLAUDE.md`, update the CLI commands table to include the new flags. Add after the `cc-config-sync clean-backups` row:

Add `--non-interactive` to the description and add new flags to the table.

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: add non-interactive mode documentation"
````

---

### Task 10: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run linter**

Run: `npx eslint src/`
Expected: PASS (no errors)

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: Compiles successfully

- [ ] **Step 5: Smoke test CLI**

Run: `node dist/cli.js --help`
Expected: Shows `--non-interactive` in global options

Run: `node dist/cli.js init --help`
Expected: Shows `--machine-name`, `--global-path`, `--backup`, `--project` options

Run: `node dist/cli.js remove-project --help`
Expected: Shows `--delete-repo-dir` option
