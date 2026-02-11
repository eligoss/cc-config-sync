# Contributing to Claude Code Config Sync

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/aborodulin/claude-code-config-sync.git
cd claude-code-config-sync
npm install
```

## Running Tests

```bash
npm test
```

## Type Checking

```bash
npm run typecheck
```

## Project Structure

```
src/
├── cli.ts              # CLI entry point (Commander.js)
├── config.ts           # Config file read/write
├── diff.ts             # File diffing logic
├── files.ts            # File copy operations
├── filter.ts           # Project/global filtering
├── git.ts              # Git operations
├── machine.ts          # Machine hostname detection
├── paths.ts            # Path resolution
├── types.ts            # TypeScript types
├── commands/           # One file per CLI command
│   ├── add-project.ts
│   ├── clean-backups.ts
│   ├── init.ts
│   ├── list.ts
│   ├── pull.ts
│   ├── push.ts
│   ├── remove-project.ts
│   └── status.ts
└── __tests__/          # Test files
```

## Making Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run type checking: `npm run typecheck`
6. Commit with a descriptive message
7. Push and open a Pull Request

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include tests for new functionality
- Update documentation if needed
- Describe what the PR does and why

## Reporting Bugs

Open an issue at https://github.com/aborodulin/claude-code-config-sync/issues with:

- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS

## Code Style

- TypeScript strict mode
- ES modules (`import`/`export`)
- Descriptive variable names
- Self-documenting code preferred over comments
