# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.2] - 2026-06-16

### Fixed

- Re-format the README "What Gets Synced" table with Prettier so the
  `format:check` CI gate passes (the 1.4.1 skills row had widened the table).

## [1.4.1] - 2026-06-16

### Documentation

- Document per-project skills sync (added in 1.4.0): README "What Gets Synced"
  table + directory tree, and the CLAUDE.md synced-files list.

## [1.4.0] - 2026-06-15

### Added

- Per-project skills are now synced (pull, push, status). The `.claude/skills/`
  tree under each project is discovered recursively, so nested skill files
  (`<name>/SKILL.md` plus `references/`) round-trip bi-directionally. Dot-entries
  (e.g. `.DS_Store`) are skipped.

## [0.4.1] - 2026-02-23

### Fixed

- Hook scripts (`global/hooks/*.sh`) are now included in sync (pull, push, status)
- Hook files are made executable (0o755) automatically after push

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
