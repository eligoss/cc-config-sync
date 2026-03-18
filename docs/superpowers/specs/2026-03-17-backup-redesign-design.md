# Backup Redesign — Design Spec

**Date:** 2026-03-17
**Status:** Approved

---

## Problem

The current backup mechanism (`backupFile()`) renames files in-place by appending `.backup-<timestamp>` to the original filename (e.g. `~/.claude/CLAUDE.md.backup-2026-03-17T...`). This is annoying because:

1. Backups clutter the directories where the original config files live.
2. There is no opt-out — every `push` always creates backups.
3. Cleanup is manual via `clean-backups`, which scans the filesystem for `.backup-*` files.

---

## Goals

1. Store backups in a dedicated, dated folder inside the sync repo.
2. Let users opt out of backups entirely (per machine).
3. Allow per-run override of the backup preference via a CLI flag.
4. Simplify `clean-backups` to operate on the new backup folder.

---

## Design

### 1. Backup Storage Location

Backups are written inside the sync repo under `backups/`, mirroring the structure defined by `ConfigFile.label` (e.g. `global/CLAUDE.md`, `projects/yarnie/CLAUDE.md`):

```text
<repo>/
  backups/
    2026-03-17/
      my-macbook/
        global/
          CLAUDE.md
          settings.json
        projects/
          yarnie/
            CLAUDE.md
  configs/
    my-macbook/
      global/
        CLAUDE.md
```

- The date folder uses `YYYY-MM-DD` format. Multiple pushes on the same day overwrite files within that day's folder.
- Files are **copied** (not moved) using the existing `copyFileWithDir()` utility from `files.ts`. The original local file stays in place until `push` overwrites it.
- The `backups/` folder is added to `.gitignore` in the sync repo root. If the `.gitignore` file does not exist, it is created. If it exists but does not contain the `backups/` entry, the entry is appended as a new line with a trailing newline. The file is never overwritten wholesale — only appended to.

**Path mapping rule:** The backup destination for a file is constructed from the `ConfigFile` object already available in `push.ts`:

```text
<repo>/backups/YYYY-MM-DD/<machine.name>/<file.label>
```

`file.label` (e.g. `global/CLAUDE.md`, `projects/yarnie/CLAUDE.md`) is the relative path within the machine folder — it already encodes the correct mirror structure.

**Repo root:** Both `push` and `clean-backups` obtain the repo root via the existing `getSyncRepoPath()` from `config.ts`. This function is already populated by the `preAction` hook in `cli.ts` before any command runs — no additional resolution logic is needed in command files.

### 2. User Config (`~/.cc-config-sync.json`)

A new `backupsEnabled` boolean field is added:

```json
{
  "repo": "/path/to/sync-repo",
  "backupsEnabled": true
}
```

- `getBackupsEnabled(): boolean` — returns `true` when the field is absent (safe default for existing users who upgrade).
- `setBackupsEnabled(enabled: boolean): void` — persists the value alongside the existing `repo` field.

### 3. `init` Command

A new question is added **after the global config path question and before the project-adding loop** (it is part of the same config update flow, so it applies whether the user is setting up a new machine or updating an existing one):

```text
Back up local files before pushing? [Y/n]:
```

- Defaults to `Y`.
- Answer is persisted to `~/.cc-config-sync.json` via `setBackupsEnabled()`.

### 4. `push` Command

**New `--[no-]backup` flag** (Commander.js negatable option) registered in `cli.ts`:

| Invocation                        | Behavior                                            |
| --------------------------------- | --------------------------------------------------- |
| `cc-config-sync push`             | Uses `backupsEnabled` from `~/.cc-config-sync.json` |
| `cc-config-sync push --backup`    | Forces backup on for this run                       |
| `cc-config-sync push --no-backup` | Forces backup off for this run                      |

**Effective backup setting resolution:**

```text
flag provided  → use flag value (true/false)
flag absent    → use getBackupsEnabled() (defaults to true if field missing)
```

**Backup logic** (before overwriting each local file):

1. Determine effective backup setting.
2. If backup is disabled → skip.
3. If local file exists → copy it to `<repo>/backups/YYYY-MM-DD/<machine>/<file.label>` using `copyFileWithDir()`.
4. On first backup of the session, ensure `backups/` is in `<repo>/.gitignore` (append if absent, create if missing).

**Console output:**

```text
  backup → backups/2026-03-17/my-macbook/global/CLAUDE.md
```

### 5. `clean-backups` Command

Completely rewritten. No longer calls `requireMachineConfig()` — machine config is not needed to scan the backup folder.

Uses `getSyncRepoPath()` to locate `<repo>/backups/`. If `backups/` does not exist or is empty, print a friendly message and exit:

```text
No backup folders found in /path/to/repo/backups/.
```

**Flow:**

1. List top-level dated subdirectories of `<repo>/backups/` with recursive file counts.
2. Prompt for confirmation.
3. Delete all dated subdirectories recursively (using `rmSync` with `{ recursive: true }`).

```text
Backup folders in /path/to/repo/backups/:
  2026-03-15/  (2 files)
  2026-03-16/  (5 files)

Delete all backups? [y/N]:
```

### 6. `config show` Command

Displays the backup setting alongside the repo path. When `backupsEnabled` is absent from the JSON (existing users who haven't re-run `init`), indicate the implicit default:

```text
repo:    /path/to/sync-repo
backups: enabled (default)
config:  /Users/anton/.cc-config-sync.json
```

When explicitly set:

```text
repo:    /path/to/sync-repo
backups: enabled
config:  /Users/anton/.cc-config-sync.json
```

---

## Files Changed

| File                            | Change                                                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/files.ts`                  | Remove `backupFile()`. Add `backupFileToRepo(file: ConfigFile, machineName: string, repoRoot: string): void` using `copyFileWithDir()`              |
| `src/user-config.ts`            | Add `getBackupsEnabled(): boolean` and `setBackupsEnabled(enabled: boolean): void`                                                                  |
| `src/cli.ts`                    | Add `--[no-]backup` option to the `push` command definition                                                                                         |
| `src/commands/push.ts`          | Add `backup?: boolean` to `PushOptions`; call `backupFileToRepo()`; ensure `.gitignore` entry on first backup                                       |
| `src/commands/init.ts`          | Add backup preference question after global config path, before project loop; call `setBackupsEnabled()`                                            |
| `src/commands/clean-backups.ts` | Rewrite: remove `requireMachineConfig()`; use `getSyncRepoPath()`; scan `<repo>/backups/`; list dated folders with recursive file count; delete all |
| `src/commands/config.ts`        | Show `backupsEnabled` in `config show` output with "(default)" notation when field is absent                                                        |
| `src/__tests__/files.test.ts`   | Update tests: remove `backupFile()` tests; add `backupFileToRepo()` tests                                                                           |

---

## Non-Goals

- Retention policy / auto-pruning by age (can be added later).
- Per-project backup preferences.
- Committing backups to git.
