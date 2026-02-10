import { execSync } from "node:child_process";

export function gitAdd(files: string[], cwd: string): void {
  if (files.length === 0) return;
  const paths = files.map((f) => `"${f}"`).join(" ");
  execSync(`git add ${paths}`, { cwd, stdio: "pipe" });
}

export function gitCommit(message: string, cwd: string): void {
  execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd, stdio: "pipe" });
}
