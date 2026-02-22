import { readdirSync, unlinkSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { requireMachineConfig } from "../machine.js";
import { getConfigFiles } from "../paths.js";
import { ask } from "../prompt.js";

function findBackupFiles(dirs: Set<string>): string[] {
  const backups: string[] = [];
  for (const dir of dirs) {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry.includes(".backup-")) {
          backups.push(join(dir, entry));
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }
  return backups.sort();
}

export async function cleanBackupsCommand(): Promise<void> {
  const machine = requireMachineConfig();

  const files = getConfigFiles(machine.name, machine.config);
  const dirs = new Set(files.map((f) => dirname(f.localPath)));
  const backups = findBackupFiles(dirs);

  if (backups.length === 0) {
    console.log("No backup files found.");
    return;
  }

  console.log(`Found ${backups.length} backup file(s):\n`);
  for (const backup of backups) {
    console.log(`  ${backup}`);
  }

  const answer = await ask(`\nDelete all ${backups.length} backup file(s)? [y/N] `);
  if (answer !== "y" && answer !== "yes") {
    console.log("Cancelled.");
    return;
  }

  let deleted = 0;
  for (const backup of backups) {
    try {
      unlinkSync(backup);
      console.log(`  deleted  ${basename(backup)}`);
      deleted++;
    } catch (err) {
      console.error(`  error    ${basename(backup)}: ${err}`);
    }
  }

  console.log(`\nDone: ${deleted} backup file(s) deleted.`);
}
