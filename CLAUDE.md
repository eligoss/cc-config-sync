# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This repository stores Claude Code configuration files, settings, and customizations. It syncs configs across multiple machines using a git-tracked repo organized by machine hostname.

## Tech Stack

- TypeScript with `tsx` (no build step)
- Commander.js for CLI
- Node.js built-ins for file operations

## CLI Commands

| Command | Description |
|---------|-------------|
| `npm run pull` | Copy local configs into the repo (safe, only writes to repo) |
| `npm run push` | Copy repo configs to local machine (shows diffs, confirms, backs up) |
| `npm run status` | Show differences between local and repo configs |
| `npm run status -- -v` | Show differences with diffs |
| `npm run list` | Show all registered paths with existence check |
| `npm run init` | Interactive setup for current machine |
| `npm run add-project -- <name> <path>` | Add a project to track |
| `npm run remove-project -- <name>` | Remove a project from tracking |

## Config Files Synced

Per machine, the tool syncs:
- **Global** (`~/.claude/`): `CLAUDE.md`, `settings.json`, `settings.local.json`
- **Per-project**: `CLAUDE.md`, `.claude/settings.json`, `.claude/settings.local.json`

## Repo Structure

- `src/` — TypeScript source code
- `configs/<machine>/global/` — global Claude configs
- `configs/<machine>/projects/<name>/` — per-project configs
- `sync.config.json` — machine and project registry
