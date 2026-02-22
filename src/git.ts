import { execFileSync } from "node:child_process";

export function gitAdd(files: string[], cwd: string): void {
  if (files.length === 0) return;
  // execFileSync passes args directly to git, avoiding shell injection
  execFileSync("git", ["add", ...files], { cwd, stdio: "pipe" });
}

export function gitCommit(message: string, cwd: string): void {
  // execFileSync passes the message as a literal arg, no quoting/escaping needed
  execFileSync("git", ["commit", "-m", message], { cwd, stdio: "pipe" });
}
