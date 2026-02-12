# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-10

### Added

- Core sync engine with pull, push, status, list, init commands
- Project filter flags (`--project`, `--global-only`) on pull/push/status
- Push shows diffs before applying and supports `--yes` for non-interactive use
- Status shows which side is newer, hides missing-both by default (`--all` to show)
- Pull supports `--dry-run` preview and `--commit` for auto git commit
- `clean-backups` command to find and delete push backup files
- `add-project` and `remove-project` commands for managing tracked projects
- Full test suite covering diff, files, filter, config, paths, and machine modules

[0.1.0]: https://github.com/eligoss/cc-config-sync/releases/tag/v0.1.0
