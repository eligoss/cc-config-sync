# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

`cc-config-sync` — a CLI tool to sync Claude Code configuration files across multiple machines using a git-tracked repository. Published on npm as [`cc-config-sync`](https://www.npmjs.com/package/cc-config-sync).

## Tech Stack

- TypeScript (strict mode) compiled to JS via `tsc`
- Commander.js for CLI
- Node.js built-ins for file operations
- Vitest for testing
- ESLint + Prettier for linting/formatting
- Husky + lint-staged for pre-commit/pre-push hooks

## CLI Commands (when tool is installed)

| Command                                     | Description                                                          |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `cc-config-sync pull`                       | Copy local configs into the repo (safe, only writes to repo)         |
| `cc-config-sync push`                       | Copy repo configs to local machine (shows diffs, confirms, backs up) |
| `cc-config-sync status`                     | Show differences between local and repo configs                      |
| `cc-config-sync status -v`                  | Show differences with diffs                                          |
| `cc-config-sync list`                       | Show all registered paths with existence check                       |
| `cc-config-sync init`                       | Interactive setup for current machine                                |
| `cc-config-sync add-project <name> <path>`  | Add a project to track                                               |
| `cc-config-sync remove-project <name>`      | Remove a project from tracking                                       |
| `cc-config-sync rename-project <old> <new>` | Rename a tracked project                                             |
| `cc-config-sync clean-backups`              | Find and delete backup files created by push                         |
| `cc-config-sync config set-repo <path>`     | Save default sync repo path to `~/.cc-config-sync.json`              |
| `cc-config-sync config show`                | Show current config (saved repo path and config file location)       |

**Global flags:**

- `--non-interactive` — suppress all prompts (auto-detected when `CI=true`)

**Common flags** (on `push`, `pull`, `status`):

- `--yes` / `-y` — skip confirmation prompts
- `--dry-run` — preview changes without writing any files
- `--global-only` — only process global (`~/.claude/`) files
- `--project <name>` — only process one tracked project

**`init` flags (non-interactive):**

- `--machine-name <name>` — required in non-interactive mode
- `--global-path <path>` — defaults to `~/.claude`
- `--backup` / `--no-backup` — defaults to `--backup`
- `--project <name:path>` — repeatable, add project(s) during init

**`remove-project` flags:**

- `--delete-repo-dir` — also delete the project directory from the sync repo

## Development Scripts

| Script              | Description                 |
| ------------------- | --------------------------- |
| `npm test`          | Run test suite (Vitest)     |
| `npm run typecheck` | TypeScript type checking    |
| `npm run build`     | Compile to `dist/` with tsc |
| `npm run lint`      | ESLint                      |
| `npm run format`    | Prettier (write)            |

## Config Files Synced

Per machine, the tool syncs:

- **Global** (`~/.claude/`): `CLAUDE.md`, `settings.json`, `settings.local.json`, `plugins/installed_plugins.json`, `plugins/known_marketplaces.json`, `hooks/*.sh`
- **Per-project**: `CLAUDE.md`, `.claude/settings.json`, `.claude/settings.local.json`
- **Per-project memory** (`~/.claude/projects/<id>/memory/`): `MEMORY.md`

Hook scripts (`hooks/*.sh`) are automatically made executable (0o755) after push.

## Repo Structure

```
src/
  cli.ts              — Entry point, command registration
  cli-utils.ts        — Shared CLI helpers
  commands/           — One file per CLI subcommand
  __tests__/          — Vitest test files (mirror src/ structure)
  paths.ts            — File discovery (getConfigFiles)
  files.ts            — File I/O utilities (copy, backup, chmod)
  diff.ts             — Unified diff generation
  filter.ts           — --project / --global-only filtering
  machine.ts          — Machine config loading from sync.config.json
  types.ts            — Shared TypeScript types
  version.ts          — Version helper
dist/                 — Compiled JS output (gitignored)
scripts/              — Build helpers (prepend-shebang.js)
.github/workflows/    — CI: tests on PR, npm publish on v* tag
```

## Publishing

npm publish is **automated via CI** — push a `v*` tag after bumping the version:

```bash
# 1. Bump version in package.json + add CHANGELOG.md entry, commit
# 2. Tag and push:
git tag v0.4.1 && git push origin v0.4.1
```

CI validates the tag matches `package.json` version, then runs `typecheck → test → build → npm publish`.
Can also trigger manually via GitHub Actions `workflow_dispatch` with a version input.

## Local Development / Testing

```bash
npm run build             # Must build before linking
npm link                  # Installs cc-config-sync globally from dist/
cc-config-sync --version  # Verify correct version is active
npm unlink cc-config-sync # Remove when done
```

## Gotchas

### Pre-push hook blocks on failures

Husky pre-push runs **typecheck → test → build** in sequence. A type error or failing test blocks the push. Fix the root cause; never use `--no-verify`.

### ESM mocking of Node built-ins in Vitest

`vi.spyOn` cannot mock properties on native ESM modules (`node:fs`, etc.) — properties are non-configurable. Use the factory overload instead:

```typescript
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, existsSync: vi.fn(), readdirSync: vi.fn() };
});
// Control return values per-test:
vi.mocked(existsSync).mockReturnValue(false);
```

When casting mock return values to overloaded types (e.g. `readdirSync`), use `as unknown as ReturnType<typeof fn>` — a direct cast will fail TS if the types don't overlap.
