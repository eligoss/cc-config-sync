import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { ConfigFile } from "./types.js";

export function fileExists(path: string): boolean {
  return existsSync(path);
}

export function copyFileWithDir(src: string, dest: string): void {
  const dir = dirname(dest);
  mkdirSync(dir, { recursive: true });
  copyFileSync(src, dest);
}

export function backupFileToRepo(
  file: ConfigFile,
  machineName: string,
  repoRoot: string,
  date?: string,
): void {
  const dateStr = date ?? new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const backupsRoot = resolve(repoRoot, "backups");
  const dest = resolve(backupsRoot, dateStr, machineName, file.label);
  const rel = relative(backupsRoot, dest);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Invalid backup destination: ${file.label}`);
  }
  copyFileWithDir(file.localPath, dest);
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
