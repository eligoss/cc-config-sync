import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  fileExists,
  filesAreIdentical,
  copyFileWithDir,
  backupFileToRepo,
  getFileMtime,
  ensureExecutable,
} from "../files.js";
import type { ConfigFile } from "../types.js";

describe("files", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "cc-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  describe("fileExists", () => {
    it("returns true for existing file", () => {
      const file = join(tmp, "exists.txt");
      writeFileSync(file, "hello");
      expect(fileExists(file)).toBe(true);
    });

    it("returns false for missing file", () => {
      expect(fileExists(join(tmp, "nope.txt"))).toBe(false);
    });
  });

  describe("filesAreIdentical", () => {
    it("returns true when files have same content", () => {
      const a = join(tmp, "a.txt");
      const b = join(tmp, "b.txt");
      writeFileSync(a, "same content");
      writeFileSync(b, "same content");
      expect(filesAreIdentical(a, b)).toBe(true);
    });

    it("returns false when files differ", () => {
      const a = join(tmp, "a.txt");
      const b = join(tmp, "b.txt");
      writeFileSync(a, "content A");
      writeFileSync(b, "content B");
      expect(filesAreIdentical(a, b)).toBe(false);
    });

    it("returns false when one file is missing", () => {
      const a = join(tmp, "a.txt");
      writeFileSync(a, "hello");
      expect(filesAreIdentical(a, join(tmp, "missing.txt"))).toBe(false);
    });

    it("returns false when both files are missing", () => {
      expect(filesAreIdentical(join(tmp, "a.txt"), join(tmp, "b.txt"))).toBe(false);
    });
  });

  describe("copyFileWithDir", () => {
    it("copies file to existing directory", () => {
      const src = join(tmp, "src.txt");
      const dest = join(tmp, "dest.txt");
      writeFileSync(src, "data");
      copyFileWithDir(src, dest);
      expect(readFileSync(dest, "utf-8")).toBe("data");
    });

    it("creates intermediate directories", () => {
      const src = join(tmp, "src.txt");
      const dest = join(tmp, "a", "b", "c", "dest.txt");
      writeFileSync(src, "deep");
      copyFileWithDir(src, dest);
      expect(readFileSync(dest, "utf-8")).toBe("deep");
    });
  });

  describe("getFileMtime", () => {
    it("returns Date for existing file", () => {
      const file = join(tmp, "mtime.txt");
      writeFileSync(file, "hello");
      const mtime = getFileMtime(file);
      expect(mtime).toBeInstanceOf(Date);
    });

    it("returns null for non-existent file", () => {
      expect(getFileMtime(join(tmp, "nope.txt"))).toBeNull();
    });
  });

  describe("ensureExecutable", () => {
    it("sets file mode to 0o755", () => {
      const file = join(tmp, "hook.sh");
      writeFileSync(file, "#!/bin/bash"); // created without +x
      ensureExecutable(file);
      const mode = statSync(file).mode & 0o777;
      expect(mode).toBe(0o755);
    });
  });

  describe("backupFileToRepo", () => {
    it("copies file to dated repo folder mirroring label", () => {
      const localFile = join(tmp, "CLAUDE.md");
      writeFileSync(localFile, "original content");

      const repoRoot = join(tmp, "repo");
      const file: ConfigFile = {
        label: "global/CLAUDE.md",
        localPath: localFile,
        repoPath: join(repoRoot, "configs", "my-machine", "global", "CLAUDE.md"),
      };

      backupFileToRepo(file, "my-machine", repoRoot, "2026-03-17");

      const expectedBackup = join(
        repoRoot,
        "backups",
        "2026-03-17",
        "my-machine",
        "global",
        "CLAUDE.md",
      );
      expect(existsSync(expectedBackup)).toBe(true);
      expect(readFileSync(expectedBackup, "utf-8")).toBe("original content");
    });

    it("leaves original local file in place", () => {
      const localFile = join(tmp, "settings.json");
      writeFileSync(localFile, "{}");

      const repoRoot = join(tmp, "repo");
      const file: ConfigFile = {
        label: "global/settings.json",
        localPath: localFile,
        repoPath: join(repoRoot, "configs", "my-machine", "global", "settings.json"),
      };

      backupFileToRepo(file, "my-machine", repoRoot, "2026-03-17");

      expect(existsSync(localFile)).toBe(true);
      expect(readFileSync(localFile, "utf-8")).toBe("{}");
    });

    it("creates intermediate directories for nested project labels", () => {
      const localFile = join(tmp, "nested.md");
      writeFileSync(localFile, "data");

      const repoRoot = join(tmp, "repo");
      const file: ConfigFile = {
        label: "projects/my-project/CLAUDE.md",
        localPath: localFile,
        repoPath: join(repoRoot, "configs", "my-machine", "projects", "my-project", "CLAUDE.md"),
      };

      backupFileToRepo(file, "my-machine", repoRoot, "2026-03-17");

      const expectedBackup = join(
        repoRoot,
        "backups",
        "2026-03-17",
        "my-machine",
        "projects",
        "my-project",
        "CLAUDE.md",
      );
      expect(existsSync(expectedBackup)).toBe(true);
    });

    it("uses today's date when date param is omitted", () => {
      const localFile = join(tmp, "CLAUDE.md");
      writeFileSync(localFile, "hello");

      const repoRoot = join(tmp, "repo");
      const file: ConfigFile = {
        label: "global/CLAUDE.md",
        localPath: localFile,
        repoPath: join(repoRoot, "configs", "my-machine", "global", "CLAUDE.md"),
      };

      const today = new Date().toISOString().slice(0, 10);
      backupFileToRepo(file, "my-machine", repoRoot);

      const expectedBackup = join(repoRoot, "backups", today, "my-machine", "global", "CLAUDE.md");
      expect(existsSync(expectedBackup)).toBe(true);
    });
  });
});
