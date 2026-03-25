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
  return options.nonInteractive === true || process.env.CI === "true";
}
```

The global option is inherited by all commands via Commander's `optsWithGlobals()`.

**Semantics:** `--non-interactive` implies consent to the primary action of the command being invoked. No separate `--yes` flag is needed when `--non-interactive` is active.

### Per-Command Behavior

#### `push`

- `--non-interactive` applies all changes without per-file confirmation prompts.
- Existing `--yes` flag remains for backwards compatibility but is redundant with `--non-interactive`.

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

If a config already exists, `init --non-interactive` updates it (equivalent to answering "yes" to the "Update it?" prompt).

#### `remove-project`

- In non-interactive mode, defaults to **not** deleting the repo directory (safe default).
- New flag: `--delete-repo-dir` — explicitly opts in to deleting the repo directory.
- Without `--non-interactive`, behavior is unchanged (still prompts).

#### `clean-backups`

- In non-interactive mode, proceeds with deletion without prompting.
- No extra flags needed. Backups are git-tracked, so deletion is reversible.

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

### Testing

- **Unit tests for `isNonInteractive()`**: flag true, env var true, both, neither.
- **`push --non-interactive`**: applies all changes without prompting.
- **`init --non-interactive`**: fails with missing `--machine-name`; succeeds with all required flags; uses defaults for optional flags.
- **`remove-project --non-interactive`**: skips deletion prompt (keeps dir); with `--delete-repo-dir` deletes.
- **`clean-backups --non-interactive`**: deletes without prompting.
- **Existing tests remain unchanged** (interactive mode is default).
