import { execSync } from "node:child_process";
import { fileExists, getFileMtime } from "./files.js";
import type { ConfigFile, DiffResult, FileStatus } from "./types.js";

export function getFileStatus(file: ConfigFile): FileStatus {
  const localExists = fileExists(file.localPath);
  const repoExists = fileExists(file.repoPath);

  if (!localExists && !repoExists) return "missing-both";
  if (localExists && !repoExists) return "local-only";
  if (!localExists && repoExists) return "repo-only";

  try {
    execSync(`diff -q "${file.localPath}" "${file.repoPath}"`, { stdio: "pipe" });
    return "identical";
  } catch {
    return "modified";
  }
}

export function getUnifiedDiff(fromPath: string, toPath: string): string {
  try {
    execSync(`diff -u "${fromPath}" "${toPath}"`, { stdio: "pipe" });
    return "";
  } catch (e: unknown) {
    const error = e as { stdout?: Buffer; status?: number };
    if (error.status === 1 && error.stdout) {
      return error.stdout.toString("utf-8");
    }
    return "(unable to generate diff)";
  }
}

export function compareFile(file: ConfigFile): DiffResult {
  const status = getFileStatus(file);
  const diff = status === "modified" ? getUnifiedDiff(file.repoPath, file.localPath) : undefined;

  let newerSide: "local" | "repo" | undefined;
  if (status === "modified") {
    const localMtime = getFileMtime(file.localPath);
    const repoMtime = getFileMtime(file.repoPath);
    if (localMtime && repoMtime) {
      newerSide = localMtime > repoMtime ? "local" : "repo";
    }
  }

  return { file, status, diff, newerSide };
}
