# Non-Interactive Mode for cc-config-sync

**Date:** 2026-03-25
**Version:** 1.1.0

## Summary

Add a `--non-interactive` global flag and `CI=true` environment variable detection so AI agents, CI/CD pipelines, and scripts can run all CLI commands without interactive prompts or confirmations.

## Motivation

Currently, several commands (`push`, `init`, `remove-project`, `clean-backups`) require interactive input. This blocks automation by AI agents (e.g., Claude Code) and CI/CD pipelines. A non-interactive mode enables full automation while keeping the current interactive experience as the default for humans.

## Design

### Global Flag & Detection

A new global option `--non-interactive` is added to the root Commander program in `cli.ts`. The tool also detects the `CI=true` environment variable.

```
cc-config-sync --non-interactive push
cc-config-sync --non-interactive init --machine-name macbook --global-path ~/.claude
CI=true cc-config-sync push
```

**Detection helper** (added to `cli-utils.ts`):

```typescript
function isNonInteractive(options: { nonInteractive?: boolean }): boolean {
  return options.nonInteractive === true || !!process.env.CI;
}
```

The `CI` env var check uses truthiness (`!!process.env.CI`) to handle both `CI=true` and `CI=1` (used by some CI systems like GitLab CI).

The global option is inherited by all commands via Commander's `optsWithGlobals()`.

**Semantics:** `--non-interactive` implies consent to the primary action of the command being invoked. No separate `--yes` flag is needed when `--non-interactive` is active.

### Per-Command Behavior

#### `push`

- `--non-interactive` applies all changes without per-file confirmation prompts.
- Existing `--yes` flag remains for backwards compatibility but is redundant with `--non-interactive`. Note: `--yes` alone does **not** set non-interactive mode — it only skips push file prompts. `--non-interactive` is the broader mode flag.
- `--non-interactive` combined with `--dry-run` is valid: shows what would be applied without prompts and without writing files.

#### `init`

New flags (required in non-interactive mode):

| Flag                       | Required | Default              | Description                       |
| -------------------------- | -------- | -------------------- | --------------------------------- |
| `--machine-name <name>`    | Yes      | —                    | Machine identifier                |
| `--global-path <path>`     | No       | `~/.claude`          | Path to global config directory   |
| `--backup` / `--no-backup` | No       | `--backup` (enabled) | Enable/disable backups on push    |
| `--project <name:path>`    | No       | —                    | Repeatable. Add projects to track |

When `--non-interactive` is set without `--machine-name`, the command exits with:

```
Error: --machine-name is required in non-interactive mode
```

If a config already exists, `init --non-interactive` updates it (equivalent to answering "yes" to the "Update it?" prompt). When updating, omitted optional flags **preserve existing values** rather than applying defaults. For example, if the existing config has `globalConfigPath: /custom/path` and `--global-path` is not passed, the existing `/custom/path` is kept. Only explicitly provided flags overwrite existing settings.

**`--project` flag format:** Uses `name:path` delimiter. The split is performed on the **first** colon only, so paths containing colons (e.g., `C:\Users\...`) are handled correctly. The path is resolved to absolute (via `path.resolve()`). If the format is invalid (no colon), the command exits with: `Error: Invalid --project format "value", expected name:path`.

#### `remove-project`

- In non-interactive mode, defaults to **not** deleting the repo directory (safe default).
- New flag: `--delete-repo-dir` — explicitly opts in to deleting the repo directory.
- Without `--non-interactive`, behavior is unchanged (still prompts).

#### `clean-backups`

- In non-interactive mode, proceeds with deletion without prompting.
- No extra flags needed. Backups are disposable by nature — they exist only as a safety net before push operations.

#### Commands with no prompts

`pull`, `status`, `list`, `add-project`, `rename-project`, `config` — no behavior change. The `--non-interactive` flag is accepted but has no effect.

### Version

Bump from `1.0.0` to `1.1.0` (new feature, fully backwards-compatible).

### Files to Modify

| File                             | Change                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `src/cli.ts`                     | Add `--non-interactive` global option; add new flags to `init`, `remove-project` |
| `src/cli-utils.ts`               | Add `isNonInteractive()` helper                                                  |
| `src/commands/push.ts`           | Check non-interactive mode, skip prompts                                         |
| `src/commands/init.ts`           | Accept new flags, skip prompts in non-interactive mode, validate required flags  |
| `src/commands/remove-project.ts` | Check non-interactive mode + `--delete-repo-dir`, skip prompt                    |
| `src/commands/clean-backups.ts`  | Check non-interactive mode, skip prompt                                          |
| `src/version.ts`                 | Bump to `1.1.0`                                                                  |
| `package.json`                   | Bump to `1.1.0`                                                                  |
| `README.md`                      | Document non-interactive mode                                                    |
| `CLAUDE.md`                      | Update CLI commands table                                                        |

### Error Handling & Exit Codes

In non-interactive mode, commands must produce clear exit codes for automation:

- **Exit 0**: Command completed successfully.
- **Exit 1**: Missing required flags, invalid arguments, or runtime errors (file copy failure, etc.).
- Partial failures during `push --non-interactive` (e.g., one file fails to copy): log the error, continue with remaining files, exit 1.
- `remove-project --non-interactive --delete-repo-dir` when the repo directory does not exist: silently ignored (not an error).

### Command Function Signatures

All four affected commands (`push`, `init`, `remove-project`, `clean-backups`) need their function signatures updated to accept an options object containing `nonInteractive`. The `init` command currently takes zero arguments — it must be updated to accept options. Existing tests that call these functions directly will need to pass `{}` as options to maintain current behavior.

### Testing

- **Unit tests for `isNonInteractive()`**: flag true, `CI=true`, `CI=1`, both, neither.
- **`push --non-interactive`**: applies all changes without prompting.
- **`push --non-interactive --dry-run`**: shows changes without prompts, writes nothing.
- **`init --non-interactive`**: fails with missing `--machine-name`; succeeds with all required flags; uses defaults for optional flags.
- **`init --non-interactive` updating existing config**: preserves existing values for omitted flags; overwrites with explicit flags.
- **`init --non-interactive --project` validation**: malformed format (no colon) exits with error.
- **`remove-project --non-interactive`**: skips deletion prompt (keeps dir); with `--delete-repo-dir` deletes; `--delete-repo-dir` when dir doesn't exist is silent.
- **`clean-backups --non-interactive`**: deletes without prompting.
- **Exit codes**: partial failure in push exits 1; missing required flags exit 1.
- **Existing tests**: updated to pass empty options object `{}` where command signatures changed.
