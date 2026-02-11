# Claude Code Config Sync

[![Test](https://github.com/aborodulin/claude-code-config-sync/actions/workflows/test.yml/badge.svg)](https://github.com/aborodulin/claude-code-config-sync/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/claude-code-config-sync)](https://www.npmjs.com/package/claude-code-config-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A CLI tool to sync your Claude Code configuration files across multiple machines using a git-tracked repository.

## How It Works

The tool uses a **two-repo setup**:

1. **Sync repo** — a git repo where your configs are stored, organized by machine hostname
2. **This tool** — the CLI that copies files between your local machine and the sync repo

```
sync-repo/
├── sync.config.json          # Machine & project registry
└── configs/
    └── MacBook-Pro/           # One folder per machine
        ├── global/
        │   ├── CLAUDE.md
        │   ├── settings.json
        │   └── settings.local.json
        └── projects/
            ├── my-app/
            │   ├── CLAUDE.md
            │   └── .claude/
            │       ├── settings.json
            │       └── settings.local.json
            └── another-project/
                └── ...
```

## Installation

```bash
npm install -g claude-code-config-sync
```

Requires Node.js 18+.

## Quick Start

```bash
# 1. Create a sync repo (or clone an existing one)
mkdir ~/claude-sync && cd ~/claude-sync && git init

# 2. Set up your machine (interactive)
claude-code-config-sync --repo ~/claude-sync init

# 3. Pull your local configs into the sync repo
claude-code-config-sync --repo ~/claude-sync pull

# 4. Check what's different
claude-code-config-sync --repo ~/claude-sync status
```

**Tip:** Set `CLAUDE_SYNC_REPO` to avoid passing `--repo` every time:

```bash
export CLAUDE_SYNC_REPO=~/claude-sync
claude-code-config-sync pull
```

## Commands

### `init`

Interactive setup. Asks for your global config path (defaults to `~/.claude`) and lets you add projects to track.

### `pull`

Copies local config files into the sync repo. Safe — only writes to the sync repo, never touches your local files.

```bash
claude-code-config-sync pull                  # pull everything
claude-code-config-sync pull -p my-app        # pull one project
claude-code-config-sync pull --global-only    # pull global configs only
claude-code-config-sync pull --dry-run        # preview without copying
claude-code-config-sync pull --commit         # auto git commit after pull
```

### `push`

Copies configs from the sync repo back to your local machine. Shows diffs before applying, asks for confirmation, and creates backups of any files it overwrites.

```bash
claude-code-config-sync push                  # push everything (interactive)
claude-code-config-sync push -y               # apply all without prompting
claude-code-config-sync push -p my-app        # push one project
```

### `status`

Shows which files differ between your local machine and the sync repo.

```bash
claude-code-config-sync status                # summary only
claude-code-config-sync status -v             # include diffs
claude-code-config-sync status --all          # show missing-both entries
```

### `list`

Lists all registered config paths and whether they exist locally.

### `add-project <name> <path>`

Add a project to track.

```bash
claude-code-config-sync add-project my-app /path/to/my-app
```

### `remove-project <name>`

Stop tracking a project.

```bash
claude-code-config-sync remove-project my-app
```

### `clean-backups`

Find and delete backup files created by `push`.

## Configuration

### sync.config.json

The registry file in the sync repo:

```json
{
  "machines": {
    "MacBook-Pro": {
      "globalConfigPath": "/Users/me/.claude",
      "projects": {
        "my-app": "/Users/me/projects/my-app",
        "api": "/Users/me/projects/api"
      }
    }
  }
}
```

### What Gets Synced

Per machine, the tool tracks:

| Scope                          | Files                                                               |
| ------------------------------ | ------------------------------------------------------------------- |
| **Global** (`~/.claude/`)      | `CLAUDE.md`, `settings.json`, `settings.local.json`                 |
| **Per-project** (project root) | `CLAUDE.md`, `.claude/settings.json`, `.claude/settings.local.json` |

## Typical Workflow

```bash
# On machine A — save your latest configs
claude-code-config-sync pull
cd ~/claude-sync && git add -A && git commit -m "update configs" && git push

# On machine B — get the latest configs
cd ~/claude-sync && git pull
claude-code-config-sync push
```

## Development

```bash
git clone https://github.com/aborodulin/claude-code-config-sync.git
cd claude-code-config-sync
npm install
npm test
npm run typecheck
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

## License

[MIT](LICENSE)
