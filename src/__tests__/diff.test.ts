import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, utimesSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getFileStatus, getUnifiedDiff, compareFile } from "../diff.js";
import type { ConfigFile } from "../types.js";

function makeFile(label: string, localPath: string, repoPath: string): ConfigFile {
  return { label, localPath, repoPath };
}

describe("diff", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "cc-diff-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  describe("getFileStatus", () => {
    it('returns "missing-both" when neither file exists', () => {
      const file = makeFile("test", join(tmp, "local"), join(tmp, "repo"));
      expect(getFileStatus(file)).toBe("missing-both");
    });

    it('returns "local-only" when only local exists', () => {
      const local = join(tmp, "local.txt");
      writeFileSync(local, "hello");
      const file = makeFile("test", local, join(tmp, "repo.txt"));
      expect(getFileStatus(file)).toBe("local-only");
    });

    it('returns "repo-only" when only repo exists', () => {
      const repo = join(tmp, "repo.txt");
      writeFileSync(repo, "hello");
      const file = makeFile("test", join(tmp, "local.txt"), repo);
      expect(getFileStatus(file)).toBe("repo-only");
    });

    it('returns "identical" when files are the same', () => {
      const local = join(tmp, "local.txt");
      const repo = join(tmp, "repo.txt");
      writeFileSync(local, "same");
      writeFileSync(repo, "same");
      const file = makeFile("test", local, repo);
      expect(getFileStatus(file)).toBe("identical");
    });

    it('returns "modified" when files differ', () => {
      const local = join(tmp, "local.txt");
      const repo = join(tmp, "repo.txt");
      writeFileSync(local, "version A");
      writeFileSync(repo, "version B");
      const file = makeFile("test", local, repo);
      expect(getFileStatus(file)).toBe("modified");
    });
  });

  describe("getUnifiedDiff", () => {
    it("returns diff output with from as --- and to as +++", () => {
      const a = join(tmp, "a.txt");
      const b = join(tmp, "b.txt");
      writeFileSync(a, "old content\n");
      writeFileSync(b, "new content\n");

      const diff = getUnifiedDiff(a, b);
      expect(diff).toContain("--- ");
      expect(diff).toContain("+++ ");
      expect(diff).toContain("-old content");
      expect(diff).toContain("+new content");
    });

    it("returns empty string for identical files", () => {
      const a = join(tmp, "a.txt");
      const b = join(tmp, "b.txt");
      writeFileSync(a, "same\n");
      writeFileSync(b, "same\n");

      expect(getUnifiedDiff(a, b)).toBe("");
    });
  });

  describe("compareFile", () => {
    it("includes diff for modified files", () => {
      const local = join(tmp, "local.txt");
      const repo = join(tmp, "repo.txt");
      writeFileSync(local, "new content\n");
      writeFileSync(repo, "old content\n");
      const file = makeFile("test", local, repo);

      const result = compareFile(file);
      expect(result.status).toBe("modified");
      expect(result.diff).toBeDefined();
      expect(result.diff).toContain("old content");
      expect(result.diff).toContain("new content");
    });

    it("does not include diff for identical files", () => {
      const local = join(tmp, "local.txt");
      const repo = join(tmp, "repo.txt");
      writeFileSync(local, "same");
      writeFileSync(repo, "same");
      const file = makeFile("test", local, repo);

      const result = compareFile(file);
      expect(result.status).toBe("identical");
      expect(result.diff).toBeUndefined();
    });

    it("does not include diff for missing files", () => {
      const file = makeFile("test", join(tmp, "a"), join(tmp, "b"));
      const result = compareFile(file);
      expect(result.status).toBe("missing-both");
      expect(result.diff).toBeUndefined();
    });

    it('sets newerSide to "local" when local file is newer', () => {
      const local = join(tmp, "local.txt");
      const repo = join(tmp, "repo.txt");
      writeFileSync(repo, "old");
      // Set repo mtime to the past
      const past = new Date(Date.now() - 60_000);
      utimesSync(repo, past, past);
      writeFileSync(local, "new");

      const file = makeFile("test", local, repo);
      const result = compareFile(file);
      expect(result.newerSide).toBe("local");
    });

    it('sets newerSide to "repo" when repo file is newer', () => {
      const local = join(tmp, "local.txt");
      const repo = join(tmp, "repo.txt");
      writeFileSync(local, "old");
      const past = new Date(Date.now() - 60_000);
      utimesSync(local, past, past);
      writeFileSync(repo, "new");

      const file = makeFile("test", local, repo);
      const result = compareFile(file);
      expect(result.newerSide).toBe("repo");
    });

    it("does not set newerSide for non-modified files", () => {
      const local = join(tmp, "local.txt");
      const repo = join(tmp, "repo.txt");
      writeFileSync(local, "same");
      writeFileSync(repo, "same");

      const file = makeFile("test", local, repo);
      const result = compareFile(file);
      expect(result.newerSide).toBeUndefined();
    });
  });
});
