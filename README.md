# Claude Code Config Sync

A CLI tool to sync your Claude Code configuration files across multiple machines using a git-tracked repository.

## How It Works

The tool uses a **two-repo setup**:

1. **This repo** (app) — contains the CLI tool source code
2. **Sync repo** — a separate git repo where your configs are stored, organized by machine hostname

The sync repo is just a regular git folder you can push/pull with git. The CLI copies files between your local machine and this sync repo.

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

## Quick Start

```bash
# 1. Clone both repos
git clone <this-repo>
git clone <sync-repo>    # or create an empty one: mkdir sync-repo && cd sync-repo && git init

# 2. Install dependencies
cd claude-code-configs
npm install

# 3. Set up your machine (interactive)
npm run init

# 4. Pull your local configs into the sync repo
npm run pull

# 5. Check what's different
npm run status
```

## Commands

### `npm run init`

Interactive setup. Asks for your global config path (defaults to `~/.claude`) and lets you add projects to track.

### `npm run pull`

Copies local config files into the sync repo. Safe — only writes to the sync repo, never touches your local files.

### `npm run push`

Copies configs from the sync repo back to your local machine. Shows diffs before applying, asks for confirmation, and creates backups of any files it overwrites.

### `npm run status`

Shows which files differ between your local machine and the sync repo.

```bash
npm run status          # summary only
npm run status -- -v    # include diffs
```

### `npm run list`

Lists all registered config paths and whether they exist locally.

### `npm run add-project -- <name> <path>`

Add a project to track (non-interactive).

```bash
npm run add-project -- my-app /Users/me/projects/my-app
```

### `npm run remove-project -- <name>`

Stop tracking a project.

```bash
npm run remove-project -- my-app
```

## Configuration

All commands need to know where the sync repo lives. This is already configured in `package.json` scripts via `--repo ../claude-code-sync`. You can also set it with the `CLAUDE_SYNC_REPO` environment variable.

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

| Scope | Files |
|-------|-------|
| **Global** (`~/.claude/`) | `CLAUDE.md`, `settings.json`, `settings.local.json` |
| **Per-project** (project root) | `CLAUDE.md`, `.claude/settings.json`, `.claude/settings.local.json` |

## Typical Workflow

```bash
# On machine A — save your latest configs
npm run pull
cd ../claude-code-sync && git add -A && git commit -m "update configs" && git push

# On machine B — get the latest configs
cd sync-repo && git pull
cd ../claude-code-configs && npm run push
```

## Development

```bash
npm install       # install deps
npm test          # run tests
```
