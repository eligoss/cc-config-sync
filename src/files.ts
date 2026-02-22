import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { dirname } from "node:path";

export function fileExists(path: string): boolean {
  return existsSync(path);
}

export function copyFileWithDir(src: string, dest: string): void {
  const dir = dirname(dest);
  mkdirSync(dir, { recursive: true });
  copyFileSync(src, dest);
}

export function backupFile(path: string): string | null {
  if (!existsSync(path)) return null;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${path}.backup-${timestamp}`;
  renameSync(path, backupPath);
  return backupPath;
}

export function getFileMtime(path: string): Date | null {
  if (!existsSync(path)) return null;
  return statSync(path).mtime;
}

export function filesAreIdentical(pathA: string, pathB: string): boolean {
  if (!existsSync(pathA) || !existsSync(pathB)) return false;
  const a = readFileSync(pathA, "utf-8");
  const b = readFileSync(pathB, "utf-8");
  return a === b;
}
