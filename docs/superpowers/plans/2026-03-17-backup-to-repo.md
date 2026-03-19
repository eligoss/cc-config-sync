# Backup-to-Repo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move push backups from scattered in-place `.backup-*` files to a dated folder inside the sync repo, add a per-machine opt-out, and simplify `clean-backups`.

**Architecture:** `backupFileToRepo()` replaces `backupFile()` — it copies (not renames) the local file to `<repo>/backups/YYYY-MM-DD/<machine>/<file.label>` using the existing `copyFileWithDir()` utility. A `backupsEnabled` flag in `~/.cc-config-sync.json` controls the default; a `--[no-]backup` CLI flag overrides per run.

**Tech Stack:** TypeScript strict mode, Node.js `fs` built-ins, Commander.js, Vitest.

---

## Branch Setup

Before starting any task, create the feature branch:

```bash
git checkout -b feat/backup-to-repo
```

---

## Task Dependency Order

**Wave 1 (parallel):** Tasks 1, 2, 6 — independent of each other
**Wave 2 (parallel, after Wave 1):** Tasks 3, 4, 5

---

## Task 1: user-config — add backupsEnabled helpers

**Files:**

- Modify: `src/user-config.ts`
- Modify: `src/__tests__/user-config.test.ts`

Read both files before starting. The test file uses a specific isolation pattern:

- `vi.mock("node:os")` with a mutable `fakeHome` variable so `homedir()` returns a temp dir
- `beforeEach` creates the temp dir, sets `fakeHome`, and calls `vi.resetModules()` so module-level constants re-evaluate
- Each test uses `await import("../user-config.js")` to get a fresh module instance
- `afterEach` removes the temp dir

Follow this same pattern for all new tests.

- [ ] **Step 1: Write failing tests**

Add these tests inside the existing `describe("user-config", ...)` block in `src/__tests__/user-config.test.ts`:

```typescript
it("getBackupsEnabled_fieldAbsent_returnsTrue", async () => {
  writeFileSync(
    join(fakeHome, ".cc-config-sync.json"),
    JSON.stringify({ repo: "/some/repo" }) + "\n",
  );
  const { getBackupsEnabled } = await import("../user-config.js");
  expect(getBackupsEnabled()).toBe(true);
});

it("getBackupsEnabled_noFile_returnsTrue", async () => {
  const { getBackupsEnabled } = await import("../user-config.js");
  expect(getBackupsEnabled()).toBe(true);
});

it("getBackupsEnabled_explicitFalse_returnsFalse", async () => {
  writeFileSync(
    join(fakeHome, ".cc-config-sync.json"),
    JSON.stringify({ repo: "/some/repo", backupsEnabled: false }) + "\n",
  );
  const { getBackupsEnabled } = await import("../user-config.js");
  expect(getBackupsEnabled()).toBe(false);
});

it("setBackupsEnabled_persistsAlongsideExistingFields", async () => {
  writeFileSync(
    join(fakeHome, ".cc-config-sync.json"),
    JSON.stringify({ repo: "/my/repo" }) + "\n",
  );
  const { setBackupsEnabled, getBackupsEnabled, getUserConfigRepo } =
    await import("../user-config.js");
  setBackupsEnabled(false);
  expect(getBackupsEnabled()).toBe(false);
  expect(getUserConfigRepo()).toBe("/my/repo"); // existing field preserved
});

it("getBackupsEnabledRaw_fieldAbsent_returnsUndefined", async () => {
  writeFileSync(
    join(fakeHome, ".cc-config-sync.json"),
    JSON.stringify({ repo: "/some/repo" }) + "\n",
  );
  const { getBackupsEnabledRaw } = await import("../user-config.js");
  expect(getBackupsEnabledRaw()).toBeUndefined();
});

it("getBackupsEnabledRaw_explicitTrue_returnsTrue", async () => {
  writeFileSync(
    join(fakeHome, ".cc-config-sync.json"),
    JSON.stringify({ backupsEnabled: true }) + "\n",
  );
  const { getBackupsEnabledRaw } = await import("../user-config.js");
  expect(getBackupsEnabledRaw()).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/__tests__/user-config.test.ts
```

Expected: FAIL — `getBackupsEnabled is not a function` (or similar export error)

- [ ] **Step 3: Implement in `src/user-config.ts`**

Add after `setUserConfigRepo`:

```typescript
export function getBackupsEnabled(): boolean {
  const parsed = readConfigFile() as { backupsEnabled?: boolean };
  return parsed.backupsEnabled ?? true;
}

export function setBackupsEnabled(enabled: boolean): void {
  const existing = readConfigFile();
  writeFileSync(
    USER_CONFIG_PATH,
    JSON.stringify({ ...existing, backupsEnabled: enabled }, null, 2) + "\n",
  );
}

export function getBackupsEnabledRaw(): boolean | undefined {
  const parsed = readConfigFile() as { backupsEnabled?: boolean };
  return parsed.backupsEnabled;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/__tests__/user-config.test.ts
```

Expected: All PASS

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/user-config.ts src/__tests__/user-config.test.ts
git commit -m "feat(backup): add getBackupsEnabled / setBackupsEnabled / getBackupsEnabledRaw"
```

---

## Task 2: files — replace backupFile with backupFileToRepo

**Files:**

- Modify: `src/files.ts`
- Modify: `src/__tests__/files.test.ts`

Read both files before starting.

- [ ] **Step 1: Write failing tests**

In `src/__tests__/files.test.ts`:

1. Update the import at the top — remove `backupFile`, add `backupFileToRepo`:

```typescript
import {
  fileExists,
  filesAreIdentical,
  copyFileWithDir,
  backupFileToRepo,
  getFileMtime,
} from "../files.js";
import type { ConfigFile } from "../types.js";
```

2. Remove the existing `describe("backupFile", ...)` block entirely.

3. Add this new describe block:

```typescript
describe("backupFileToRepo", () => {
  it("copies file to dated repo folder mirroring label", () => {
    const localFile = join(tmp, "CLAUDE.md");
    writeFileSync(localFile, "original content");

    const repoRoot = join(tmp, "repo");
    const file: ConfigFile = {
      label: "global/CLAUDE.md",
      localPath: localFile,
      repoPath: join(repoRoot, "configs", "my-machine", "global", "CLAUDE.md"),
    };

    backupFileToRepo(file, "my-machine", repoRoot, "2026-03-17");

    const expectedBackup = join(
      repoRoot,
      "backups",
      "2026-03-17",
      "my-machine",
      "global",
      "CLAUDE.md",
    );
    expect(existsSync(expectedBackup)).toBe(true);
    expect(readFileSync(expectedBackup, "utf-8")).toBe("original content");
  });

  it("leaves original local file in place", () => {
    const localFile = join(tmp, "settings.json");
    writeFileSync(localFile, "{}");

    const repoRoot = join(tmp, "repo");
    const file: ConfigFile = {
      label: "global/settings.json",
      localPath: localFile,
      repoPath: join(repoRoot, "configs", "my-machine", "global", "settings.json"),
    };

    backupFileToRepo(file, "my-machine", repoRoot, "2026-03-17");

    expect(existsSync(localFile)).toBe(true);
    expect(readFileSync(localFile, "utf-8")).toBe("{}");
  });

  it("creates intermediate directories for nested project labels", () => {
    const localFile = join(tmp, "nested.md");
    writeFileSync(localFile, "data");

    const repoRoot = join(tmp, "repo");
    const file: ConfigFile = {
      label: "projects/my-project/CLAUDE.md",
      localPath: localFile,
      repoPath: join(repoRoot, "configs", "my-machine", "projects", "my-project", "CLAUDE.md"),
    };

    backupFileToRepo(file, "my-machine", repoRoot, "2026-03-17");

    const expectedBackup = join(
      repoRoot,
      "backups",
      "2026-03-17",
      "my-machine",
      "projects",
      "my-project",
      "CLAUDE.md",
    );
    expect(existsSync(expectedBackup)).toBe(true);
  });

  it("uses today's date when date param is omitted", () => {
    const localFile = join(tmp, "CLAUDE.md");
    writeFileSync(localFile, "hello");

    const repoRoot = join(tmp, "repo");
    const file: ConfigFile = {
      label: "global/CLAUDE.md",
      localPath: localFile,
      repoPath: join(repoRoot, "configs", "my-machine", "global", "CLAUDE.md"),
    };

    const today = new Date().toISOString().slice(0, 10);
    backupFileToRepo(file, "my-machine", repoRoot);

    const expectedBackup = join(repoRoot, "backups", today, "my-machine", "global", "CLAUDE.md");
    expect(existsSync(expectedBackup)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/__tests__/files.test.ts
```

Expected: FAIL — `backupFileToRepo is not exported`

- [ ] **Step 3: Implement in `src/files.ts`**

Update the imports at the top of `src/files.ts`. The current file imports:

```typescript
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { dirname } from "node:path";
```

Change to (remove `renameSync`, add `join`):

```typescript
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ConfigFile } from "./types.js";
```

Remove the `backupFile` function entirely:

```typescript
// DELETE this entire function:
export function backupFile(path: string): string | null {
  if (!existsSync(path)) return null;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${path}.backup-${timestamp}`;
  renameSync(path, backupPath);
  return backupPath;
}
```

Add the new function after `copyFileWithDir`:

```typescript
export function backupFileToRepo(
  file: ConfigFile,
  machineName: string,
  repoRoot: string,
  date?: string,
): void {
  const dateStr = date ?? new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dest = join(repoRoot, "backups", dateStr, machineName, file.label);
  copyFileWithDir(file.localPath, dest);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/__tests__/files.test.ts
```

Expected: All PASS

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: errors about `backupFile` still imported in `push.ts` — this is expected and will be fixed in Task 5. All other errors should be absent.

- [ ] **Step 6: Commit**

```bash
git add src/files.ts src/__tests__/files.test.ts
git commit -m "feat(backup): replace backupFile with backupFileToRepo"
```

---

## Task 3: init — add backup preference question

**Files:**

- Modify: `src/commands/init.ts`

Read the file before starting. Task 1 must be complete.

No dedicated test file for init (interactive prompts make unit testing impractical). Typecheck is the verification.

- [ ] **Step 1: Update imports**

At the top of `src/commands/init.ts`, add:

```typescript
import { setBackupsEnabled, getBackupsEnabled } from "../user-config.js";
```

- [ ] **Step 2: Add the backup question**

After the `globalConfigPath` prompt and the `existsSync(globalConfigPath)` warning, and before the `console.log("\nAdd projects to sync...")` line, insert:

```typescript
const existingBackupsEnabled = existingConfig !== undefined ? getBackupsEnabled() : true;
const backupAnswer = await ask(
  "Back up local files before pushing?",
  existingBackupsEnabled ? "Y" : "n",
);
const backupsEnabled = backupAnswer.toLowerCase() !== "n" && backupAnswer.toLowerCase() !== "no";
```

- [ ] **Step 3: Persist and display**

After `saveConfig(config)`, add:

```typescript
setBackupsEnabled(backupsEnabled);
```

In the summary `console.log` block at the bottom, add:

```typescript
console.log(`  Backups: ${backupsEnabled ? "enabled" : "disabled"}`);
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/commands/init.ts
git commit -m "feat(backup): add backup preference question to init"
```

---

## Task 4: config show — display backupsEnabled

**Files:**

- Modify: `src/commands/config.ts`

Read the file before starting. Task 1 must be complete.

- [ ] **Step 1: Update imports in `src/commands/config.ts`**

Replace current import:

```typescript
import { setUserConfigRepo, getUserConfigRepo, USER_CONFIG_PATH } from "../user-config.js";
```

With:

```typescript
import {
  setUserConfigRepo,
  getUserConfigRepo,
  getBackupsEnabledRaw,
  USER_CONFIG_PATH,
} from "../user-config.js";
```

- [ ] **Step 2: Update `configShowCommand`**

Replace current `configShowCommand`:

```typescript
export function configShowCommand(): void {
  const repo = getUserConfigRepo();
  if (!repo) {
    console.error("No repo path configured.");
    console.error(`Run: cc-config-sync config set-repo <path>`);
    return;
  }
  console.log(`repo: ${repo}`);
  console.log(`config file: ${USER_CONFIG_PATH}`);
}
```

With:

```typescript
export function configShowCommand(): void {
  const repo = getUserConfigRepo();
  if (!repo) {
    console.error("No repo path configured.");
    console.error(`Run: cc-config-sync config set-repo <path>`);
    return;
  }
  const raw = getBackupsEnabledRaw();
  const backupsLabel = raw === undefined ? "enabled (default)" : raw ? "enabled" : "disabled";
  console.log(`repo:    ${repo}`);
  console.log(`backups: ${backupsLabel}`);
  console.log(`config:  ${USER_CONFIG_PATH}`);
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/commands/config.ts
git commit -m "feat(backup): show backupsEnabled in config show"
```

---

## Task 5: push — integrate backupFileToRepo and --[no-]backup flag

**Files:**

- Modify: `src/commands/push.ts`
- Modify: `src/cli.ts`

Read both files before starting. Tasks 1 and 2 must be complete.

- [ ] **Step 1: Update `src/cli.ts`**

In the `push` command definition, add the negatable option (after `--dry-run`):

```typescript
  .option("--[no-]backup", "Override backup setting for this run (default: from ~/.cc-config-sync.json)")
```

The full push command block becomes:

```typescript
program
  .command("push")
  .description("Copy repo configs to local machine")
  .option("-p, --project <name>", "Only push configs for a specific project")
  .option("--global-only", "Only push global configs")
  .option("-y, --yes", "Apply all changes without prompting")
  .option("--dry-run", "Show what would be applied without copying files or creating backups")
  .option(
    "--[no-]backup",
    "Override backup setting for this run (default: from ~/.cc-config-sync.json)",
  )
  .action(pushCommand);
```

- [ ] **Step 2: Update imports in `src/commands/push.ts`**

Replace the current import block entirely:

```typescript
import { existsSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { requireMachineConfig } from "../machine.js";
import { getConfigFiles } from "../paths.js";
import { fileExists, copyFileWithDir, filesAreIdentical, backupFileToRepo } from "../files.js";
import { getUnifiedDiff } from "../diff.js";
import { filterConfigFiles } from "../filter.js";
import { ask } from "../prompt.js";
import { getBackupsEnabled } from "../user-config.js";
import { getSyncRepoPath } from "../config.js";
```

- [ ] **Step 3: Update `PushOptions` interface**

```typescript
interface PushOptions {
  project?: string;
  globalOnly?: boolean;
  yes?: boolean;
  dryRun?: boolean;
  backup?: boolean; // undefined = use user config; true/false = override
}
```

- [ ] **Step 4: Add `ensureBackupsGitignored` helper**

Add this function before `pushCommand`:

```typescript
function ensureBackupsGitignored(repoRoot: string): void {
  const gitignorePath = join(repoRoot, ".gitignore");
  const entry = "backups/";
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf-8");
    if (content.split("\n").some((line) => line.trim() === entry)) return;
    appendFileSync(gitignorePath, `\n${entry}\n`);
  } else {
    writeFileSync(gitignorePath, `${entry}\n`);
  }
}
```

- [ ] **Step 5: Rewrite `pushCommand` body**

```typescript
export async function pushCommand(options: PushOptions): Promise<void> {
  const machine = requireMachineConfig();
  const repoRoot = getSyncRepoPath();
  const backupsEnabled = options.backup !== undefined ? options.backup : getBackupsEnabled();

  let files = getConfigFiles(machine.name, machine.config);
  files = filterConfigFiles(files, { project: options.project, globalOnly: options.globalOnly });

  let pushed = 0;
  let skipped = 0;
  let applyAll = options.yes ?? false;
  let gitignoreEnsured = false;

  console.log(`${options.dryRun ? "[DRY RUN] " : ""}Pushing configs to machine: ${machine.name}\n`);

  for (const file of files) {
    if (!fileExists(file.repoPath)) {
      console.log(`  skip  ${file.label} (not in repo)`);
      skipped++;
      continue;
    }

    if (fileExists(file.localPath) && filesAreIdentical(file.localPath, file.repoPath)) {
      console.log(`  same  ${file.label}`);
      skipped++;
      continue;
    }

    if (fileExists(file.localPath)) {
      console.log(`\n--- Changes for ${file.label} ---`);
      const diff = getUnifiedDiff(file.localPath, file.repoPath);
      console.log(diff || "(files differ but diff unavailable)");
    } else {
      console.log(`\n  new   ${file.label} (will be created)`);
    }

    if (options.dryRun) {
      console.log(`  would push  ${file.label}`);
      pushed++;
      continue;
    }

    if (!applyAll) {
      const answer = await ask(`  Apply this change? [y/n/a] `);
      if (answer === "a" || answer === "all") {
        applyAll = true;
      } else if (answer !== "y" && answer !== "yes") {
        console.log("  skipped.");
        skipped++;
        continue;
      }
    }

    if (backupsEnabled && fileExists(file.localPath)) {
      if (!gitignoreEnsured) {
        ensureBackupsGitignored(repoRoot);
        gitignoreEnsured = true;
      }
      const dateStr = new Date().toISOString().slice(0, 10);
      backupFileToRepo(file, machine.name, repoRoot, dateStr);
      console.log(`  backup → backups/${dateStr}/${machine.name}/${file.label}`);
    }

    copyFileWithDir(file.repoPath, file.localPath);
    console.log(`  push  ${file.label}`);
    pushed++;
  }

  if (options.dryRun) {
    console.log(`\nDone (dry run): ${pushed} would be pushed, ${skipped} skipped.`);
  } else {
    console.log(`\nDone: ${pushed} pushed, ${skipped} skipped.`);
  }
}
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 7: Run full test suite**

```bash
npm test
```

Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add src/commands/push.ts src/cli.ts
git commit -m "feat(backup): integrate backupFileToRepo and --[no-]backup flag into push"
```

---

## Task 6: clean-backups — rewrite to scan repo backups folder

**Files:**

- Modify: `src/commands/clean-backups.ts`

Read the file before starting. Independent of all other tasks.

- [ ] **Step 1: Write the implementation**

Replace the entire file with:

```typescript
import { readdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { getSyncRepoPath } from "../config.js";
import { ask } from "../prompt.js";

function countFilesRecursive(dir: string): number {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countFilesRecursive(join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

export async function cleanBackupsCommand(): Promise<void> {
  const backupsDir = join(getSyncRepoPath(), "backups");

  if (!existsSync(backupsDir)) {
    console.log(`No backup folders found in ${backupsDir}.`);
    return;
  }

  const entries = readdirSync(backupsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  if (entries.length === 0) {
    console.log(`No backup folders found in ${backupsDir}.`);
    return;
  }

  console.log(`Backup folders in ${backupsDir}:\n`);
  for (const entry of entries) {
    const count = countFilesRecursive(join(backupsDir, entry));
    console.log(`  ${entry}/  (${count} file${count === 1 ? "" : "s"})`);
  }

  const answer = await ask(`\nDelete all backups? [y/N] `);
  if (answer !== "y" && answer !== "yes") {
    console.log("Cancelled.");
    return;
  }

  let deleted = 0;
  for (const entry of entries) {
    try {
      rmSync(join(backupsDir, entry), { recursive: true });
      console.log(`  deleted  ${entry}/`);
      deleted++;
    } catch (err) {
      console.error(`  error    ${entry}/: ${err}`);
    }
  }

  console.log(`\nDone: ${deleted} backup folder(s) deleted.`);
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/commands/clean-backups.ts
git commit -m "feat(backup): rewrite clean-backups to scan repo backups folder"
```

---

## Final: full verification

- [ ] **Run all tests**

```bash
npm test
```

Expected: all pass, no failures

- [ ] **Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Lint**

```bash
npm run lint
```

Expected: no errors
