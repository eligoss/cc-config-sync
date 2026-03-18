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

Backups are written inside the sync repo under `backups/`, mirroring the `configs/<machine>/` structure:

```
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

- The date folder uses `YYYY-MM-DD` format. Multiple pushes on the same day overwrite files within that day's folder (no sub-second bloat).
- Files are **copied** (not moved) into the backup folder — the original local file remains in place until `push` overwrites it.
- The `backups/` folder is added to `.gitignore` in the sync repo. If `.gitignore` does not already contain `backups/`, `push` writes it automatically.

### 2. User Config (`~/.cc-config-sync.json`)

A new `backupsEnabled` boolean field is added:

```json
{
  "repo": "/path/to/sync-repo",
  "backupsEnabled": true
}
```

- Defaults to `true` when the field is absent (safe default for existing users who upgrade).
- Two new functions in `user-config.ts`:
  - `getBackupsEnabled(): boolean`
  - `setBackupsEnabled(enabled: boolean): void`

### 3. `init` Command

A new question is added after the global config path prompt:

```
Back up local files before pushing? [Y/n]:
```

- Defaults to `Y`.
- Answer is persisted to `~/.cc-config-sync.json` via `setBackupsEnabled()`.

### 4. `push` Command

**New `--[no-]backup` flag** (Commander.js negatable option):

| Invocation                        | Behavior                                            |
| --------------------------------- | --------------------------------------------------- |
| `cc-config-sync push`             | Uses `backupsEnabled` from `~/.cc-config-sync.json` |
| `cc-config-sync push --backup`    | Forces backup on for this run                       |
| `cc-config-sync push --no-backup` | Forces backup off for this run                      |

**Backup logic** (before overwriting each local file):

1. Determine effective backup setting: flag overrides config; config defaults to `true`.
2. If backup is disabled → skip.
3. If backup is enabled and local file exists → copy file to `<repo>/backups/YYYY-MM-DD/<machine>/<mirrored-path>`.
4. Ensure `backups/` is in the repo's `.gitignore`.

**Console output changes:**

Before:

```
  backup → /Users/anton/.claude/CLAUDE.md.backup-2026-03-17T14-32-05-123Z
```

After:

```
  backup → backups/2026-03-17/my-macbook/global/CLAUDE.md
```

### 5. `clean-backups` Command

Simplified — no flags. Scans `<repo>/backups/` for dated folders, lists what it found, prompts for confirmation, then deletes all:

```
Backup folders in /path/to/repo/backups/:
  2026-03-15/  (2 files)
  2026-03-16/  (5 files)

Delete all backups? [y/N]:
```

If `backups/` does not exist or is empty, prints a friendly message and exits.

### 6. `config show` Command

Displays the backup setting alongside the repo path:

```
Repo:    /path/to/sync-repo
Backups: enabled
```

---

## Files Changed

| File                            | Change                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `src/files.ts`                  | Update `backupFile()` to copy into dated repo folder; accept repo path + machine name |
| `src/user-config.ts`            | Add `getBackupsEnabled()` and `setBackupsEnabled()`                                   |
| `src/commands/push.ts`          | Add `--[no-]backup` flag; integrate new backup logic                                  |
| `src/commands/init.ts`          | Add backup preference question                                                        |
| `src/commands/clean-backups.ts` | Rewrite to clean `<repo>/backups/` folder                                             |
| `src/commands/config.ts`        | Show `backupsEnabled` in `config show` output                                         |

---

## Non-Goals

- Retention policy / auto-pruning by age (can be added later).
- Per-project backup preferences.
- Committing backups to git.
