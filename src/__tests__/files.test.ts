import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileExists, filesAreIdentical, copyFileWithDir, backupFile, getFileMtime } from "../files.js";

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

  describe("backupFile", () => {
    it("returns null for non-existent file", () => {
      expect(backupFile(join(tmp, "nope.txt"))).toBeNull();
    });

    it("renames file with backup suffix", () => {
      const file = join(tmp, "config.json");
      writeFileSync(file, "original");
      const backupPath = backupFile(file);

      expect(backupPath).not.toBeNull();
      expect(backupPath).toMatch(/config\.json\.backup-/);
      expect(existsSync(backupPath!)).toBe(true);
      expect(existsSync(file)).toBe(false);
      expect(readFileSync(backupPath!, "utf-8")).toBe("original");
    });
  });
});
