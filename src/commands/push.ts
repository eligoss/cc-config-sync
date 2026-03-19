import { existsSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { join, normalize, isAbsolute } from "node:path";
import { requireMachineConfig } from "../machine.js";
import { getConfigFiles } from "../paths.js";
import { fileExists, copyFileWithDir, filesAreIdentical, backupFileToRepo } from "../files.js";
import { getUnifiedDiff } from "../diff.js";
import { filterConfigFiles } from "../filter.js";
import { ask } from "../prompt.js";
import { getBackupsEnabled } from "../user-config.js";
import { getSyncRepoPath } from "../config.js";

interface PushOptions {
  project?: string;
  globalOnly?: boolean;
  yes?: boolean;
  dryRun?: boolean;
  backup?: boolean; // undefined = use user config; true/false = override
}

function assertSafeBackupLabel(label: string): void {
  const normalized = normalize(label).replace(/\\/g, "/");
  if (
    isAbsolute(label) ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    throw new Error(`Unsafe backup label: ${label}`);
  }
}

function ensureBackupsGitignored(repoRoot: string): void {
  const gitignorePath = join(repoRoot, ".gitignore");
  const entry = "backups/";
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf-8");
    if (content.split("\n").some((line) => line.trim() === entry)) return;
    appendFileSync(gitignorePath, `\n${entry}\n`);
  } else {
    writeFileSync(gitignorePath, `${entry}\n`);
  }
}

export async function pushCommand(options: PushOptions): Promise<void> {
  const machine = requireMachineConfig();
  const repoRoot = getSyncRepoPath();
  const backupsEnabled = options.backup !== undefined ? options.backup : getBackupsEnabled();

  let files = getConfigFiles(machine.name, machine.config);
  files = filterConfigFiles(files, { project: options.project, globalOnly: options.globalOnly });

  let pushed = 0;
  let skipped = 0;
  let applyAll = options.yes ?? false;
  let gitignoreEnsured = false;
  const backupDate = new Date().toISOString().slice(0, 10);

  console.log(`${options.dryRun ? "[DRY RUN] " : ""}Pushing configs to machine: ${machine.name}\n`);

  for (const file of files) {
    if (!fileExists(file.repoPath)) {
      console.log(`  skip  ${file.label} (not in repo)`);
      skipped++;
      continue;
    }

    if (fileExists(file.localPath) && filesAreIdentical(file.localPath, file.repoPath)) {
      console.log(`  same  ${file.label}`);
      skipped++;
      continue;
    }

    if (fileExists(file.localPath)) {
      console.log(`\n--- Changes for ${file.label} ---`);
      const diff = getUnifiedDiff(file.localPath, file.repoPath);
      console.log(diff || "(files differ but diff unavailable)");
    } else {
      console.log(`\n  new   ${file.label} (will be created)`);
    }

    if (options.dryRun) {
      console.log(`  would push  ${file.label}`);
      pushed++;
      continue;
    }

    if (!applyAll) {
      const answer = await ask(`  Apply this change? [y/n/a] `);
      if (answer === "a" || answer === "all") {
        applyAll = true;
      } else if (answer !== "y" && answer !== "yes") {
        console.log("  skipped.");
        skipped++;
        continue;
      }
    }

    if (backupsEnabled && fileExists(file.localPath)) {
      assertSafeBackupLabel(file.label);
      if (!gitignoreEnsured) {
        ensureBackupsGitignored(repoRoot);
        gitignoreEnsured = true;
      }
      backupFileToRepo(file, machine.name, repoRoot, backupDate);
      console.log(`  backup → backups/${backupDate}/${machine.name}/${file.label}`);
    }

    copyFileWithDir(file.repoPath, file.localPath);
    console.log(`  push  ${file.label}`);
    pushed++;
  }

  if (options.dryRun) {
    console.log(`\nDone (dry run): ${pushed} would be pushed, ${skipped} skipped.`);
  } else {
    console.log(`\nDone: ${pushed} pushed, ${skipped} skipped.`);
  }
}
