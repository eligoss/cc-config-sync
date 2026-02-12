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
- Husky + lint-staged for pre-commit hooks

## CLI Commands

| Command                                    | Description                                                          |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `cc-config-sync pull`                      | Copy local configs into the repo (safe, only writes to repo)         |
| `cc-config-sync push`                      | Copy repo configs to local machine (shows diffs, confirms, backs up) |
| `cc-config-sync status`                    | Show differences between local and repo configs                      |
| `cc-config-sync status -v`                 | Show differences with diffs                                          |
| `cc-config-sync list`                      | Show all registered paths with existence check                       |
| `cc-config-sync init`                      | Interactive setup for current machine                                |
| `cc-config-sync add-project <name> <path>` | Add a project to track                                               |
| `cc-config-sync remove-project <name>`     | Remove a project from tracking                                       |
| `cc-config-sync clean-backups`             | Find and delete backup files created by push                         |

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

- **Global** (`~/.claude/`): `CLAUDE.md`, `settings.json`, `settings.local.json`
- **Per-project**: `CLAUDE.md`, `.claude/settings.json`, `.claude/settings.local.json`

## Repo Structure

- `src/` — TypeScript source code
- `src/commands/` — One file per CLI command
- `src/__tests__/` — Test files
- `dist/` — Compiled JS output (gitignored)
- `scripts/` — Build helpers
- `.github/workflows/` — CI/CD (test + npm publish)
- `configs/<machine>/global/` — global Claude configs (in sync repo)
- `configs/<machine>/projects/<name>/` — per-project configs (in sync repo)
- `sync.config.json` — machine and project registry (in sync repo)
