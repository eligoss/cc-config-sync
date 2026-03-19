import { readdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { getSyncRepoPath } from "../config.js";
import { ask } from "../prompt.js";

function countFilesRecursive(dir: string): number {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countFilesRecursive(join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

export async function cleanBackupsCommand(): Promise<void> {
  const backupsDir = join(getSyncRepoPath(), "backups");

  if (!existsSync(backupsDir)) {
    console.log(`No backup folders found in ${backupsDir}.`);
    return;
  }

  const dateFolderPattern = /^\d{4}-\d{2}-\d{2}$/;
  const entries = readdirSync(backupsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && dateFolderPattern.test(e.name))
    .map((e) => e.name)
    .sort();

  if (entries.length === 0) {
    console.log(`No dated backup folders found in ${backupsDir}.`);
    return;
  }

  console.log(`Backup folders in ${backupsDir}:\n`);
  for (const entry of entries) {
    const count = countFilesRecursive(join(backupsDir, entry));
    console.log(`  ${entry}/  (${count} file${count === 1 ? "" : "s"})`);
  }

  const answer = await ask(`\nDelete all backups? [y/N] `);
  if (answer !== "y" && answer !== "yes") {
    console.log("Cancelled.");
    return;
  }

  let deleted = 0;
  for (const entry of entries) {
    try {
      rmSync(join(backupsDir, entry), { recursive: true });
      console.log(`  deleted  ${entry}/`);
      deleted++;
    } catch (err) {
      console.error(`  error    ${entry}/: ${err}`);
    }
  }

  console.log(`\nDone: ${deleted} backup folder(s) deleted.`);
}
