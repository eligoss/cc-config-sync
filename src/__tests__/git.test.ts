import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { gitAdd, gitCommit } from "../git.js";

/** Initialize a minimal git repo in the given directory. */
function initGitRepo(dir: string): void {
  execSync("git init", { cwd: dir, stdio: "pipe" });
  execSync("git config user.email test@example.com", { cwd: dir, stdio: "pipe" });
  execSync("git config user.name Test", { cwd: dir, stdio: "pipe" });
}

describe("git", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "cc-git-"));
    initGitRepo(tmp);
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  describe("gitAdd", () => {
    it("gitAdd_normalPaths_stagesFiles", () => {
      const fileA = join(tmp, "a.txt");
      const fileB = join(tmp, "b.txt");
      writeFileSync(fileA, "hello");
      writeFileSync(fileB, "world");

      gitAdd([fileA, fileB], tmp);

      const status = execSync("git status --porcelain", { cwd: tmp, stdio: "pipe" }).toString();
      expect(status).toContain("A  a.txt");
      expect(status).toContain("A  b.txt");
    });

    it("gitAdd_emptyArray_doesNothing", () => {
      // Should not throw
      expect(() => gitAdd([], tmp)).not.toThrow();
    });

    it("gitAdd_pathWithSpaces_stagesFile", () => {
      const fileWithSpaces = join(tmp, "my file.txt");
      writeFileSync(fileWithSpaces, "content");

      gitAdd([fileWithSpaces], tmp);

      const status = execSync("git status --porcelain", { cwd: tmp, stdio: "pipe" }).toString();
      expect(status).toContain("my file.txt");
    });
  });

  describe("gitCommit", () => {
    it("gitCommit_normalMessage_createsCommit", () => {
      const file = join(tmp, "readme.txt");
      writeFileSync(file, "init");
      gitAdd([file], tmp);

      gitCommit("initial commit", tmp);

      const log = execSync("git log --oneline", { cwd: tmp, stdio: "pipe" }).toString();
      expect(log).toContain("initial commit");
    });

    it("gitCommit_messageWithSpecialChars_preservesMessage", () => {
      const file = join(tmp, "file.txt");
      writeFileSync(file, "data");
      gitAdd([file], tmp);

      // Special characters that could trip up shell-based implementations
      const msg = `feat: sync "Anton's" configs (100% done) [v1.0]`;
      gitCommit(msg, tmp);

      const log = execSync("git log --format=%s", { cwd: tmp, stdio: "pipe" }).toString().trim();
      expect(log).toBe(msg);
    });

    it("gitCommit_messageWithNewline_preservesMessage", () => {
      const file = join(tmp, "multi.txt");
      writeFileSync(file, "content");
      gitAdd([file], tmp);

      const msg = "feat: add feature\n\n- bullet one\n- bullet two";
      gitCommit(msg, tmp);

      const log = execSync("git log --format=%B -1", { cwd: tmp, stdio: "pipe" })
        .toString()
        .trim();
      expect(log).toBe(msg);
    });
  });
});
