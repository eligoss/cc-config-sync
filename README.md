# Claude Code Config Sync

[![Test](https://github.com/eligoss/cc-config-sync/actions/workflows/test.yml/badge.svg)](https://github.com/eligoss/cc-config-sync/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/cc-config-sync)](https://www.npmjs.com/package/cc-config-sync)
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
        │   ├── settings.local.json
        │   └── plugins/
        │       ├── installed_plugins.json
        │       └── known_marketplaces.json
        └── projects/
            ├── my-app/
            │   ├── CLAUDE.md
            │   ├── .claude/
            │   │   ├── settings.json
            │   │   └── settings.local.json
            │   └── memory/
            │       └── MEMORY.md
            └── another-project/
                └── ...
```

## Installation

```bash
npm install -g cc-config-sync
```

Requires Node.js 18+.

### Updating

To update to the latest version:

```bash
npm update -g cc-config-sync
```

Check your installed version:

```bash
cc-config-sync --version
```

## Quick Start

```bash
# 1. Create a sync repo (or clone an existing one)
mkdir ~/claude-sync && cd ~/claude-sync && git init

# 2. Save the repo path so you never have to type --repo again
cc-config-sync config set-repo ~/claude-sync

# 3. Set up your machine (interactive)
cc-config-sync init

# 4. Pull your local configs into the sync repo
cc-config-sync pull

# 5. Check what's different
cc-config-sync status
```

**Tip:** `cc-config-sync config set-repo <path>` saves the repo path to `~/.cc-config-sync.json`.
After that, all commands just work in any terminal without additional flags.
You can still override it per-command with `--repo <path>` or the `CLAUDE_SYNC_REPO` env var.

## Commands

### `init`

Interactive setup. Asks for your global config path (defaults to `~/.claude`) and lets you add projects to track.

### `pull`

Copies local config files into the sync repo. Safe — only writes to the sync repo, never touches your local files.

```bash
cc-config-sync pull                  # pull everything
cc-config-sync pull -p my-app        # pull one project
cc-config-sync pull --global-only    # pull global configs only
cc-config-sync pull --dry-run        # preview without copying
cc-config-sync pull --commit         # auto git commit after pull
```

### `push`

Copies configs from the sync repo back to your local machine. Shows diffs before applying, asks for confirmation, and creates backups of any files it overwrites.

```bash
cc-config-sync push                  # push everything (interactive)
cc-config-sync push -y               # apply all without prompting
cc-config-sync push -p my-app        # push one project
```

### `status`

Shows which files differ between your local machine and the sync repo.

```bash
cc-config-sync status                # summary only
cc-config-sync status -v             # include diffs
cc-config-sync status --all          # show missing-both entries
```

### `list`

Lists all registered config paths and whether they exist locally.

### `add-project <name> <path>`

Add a project to track.

```bash
cc-config-sync add-project my-app /path/to/my-app
```

### `remove-project <name>`

Stop tracking a project.

```bash
cc-config-sync remove-project my-app
```

### `clean-backups`

Find and delete backup files created by `push`.

### `config set-repo <path>`

Save the sync repo path persistently so you don't have to pass `--repo` or set `CLAUDE_SYNC_REPO` every time.

```bash
cc-config-sync config set-repo ~/claude-sync
```

The path is stored in `~/.cc-config-sync.json`. Resolution order (highest priority first):

1. `--repo <path>` flag
2. `CLAUDE_SYNC_REPO` env var
3. `~/.cc-config-sync.json` (saved with `config set-repo`)
4. Error if none found

### `config show`

Display the currently saved repo path and config file location.

```bash
cc-config-sync config show
```

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

| Scope                          | Files                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Global** (`~/.claude/`)      | `CLAUDE.md`, `settings.json`, `settings.local.json`, `plugins/installed_plugins.json`, `plugins/known_marketplaces.json` |
| **Per-project** (project root) | `CLAUDE.md`, `.claude/settings.json`, `.claude/settings.local.json`                                                      |
| **Per-project** (memory)       | `~/.claude/projects/<project-id>/memory/MEMORY.md`                                                                       |

## Typical Workflow

```bash
# On machine A — save your latest configs
cc-config-sync pull
cd ~/claude-sync && git add -A && git commit -m "update configs" && git push

# On machine B — get the latest configs
cd ~/claude-sync && git pull
cc-config-sync push
```

## Development

```bash
git clone https://github.com/eligoss/cc-config-sync.git
cd cc-config-sync
npm install
npm test
npm run typecheck
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

## License

[MIT](LICENSE)
