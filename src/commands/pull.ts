import { getCurrentMachineConfig } from "../machine.js";
import { getConfigFiles } from "../paths.js";
import { fileExists, copyFileWithDir, filesAreIdentical } from "../files.js";
import { getUnifiedDiff } from "../diff.js";
import { filterConfigFiles } from "../filter.js";
import { gitAdd, gitCommit } from "../git.js";
import { getSyncRepoPath } from "../config.js";

interface PullOptions {
  project?: string;
  globalOnly?: boolean;
  dryRun?: boolean;
  commit?: boolean;
}

export function pullCommand(options: PullOptions): void {
  const machine = getCurrentMachineConfig();
  if (!machine) {
    console.error("No configuration found for this machine. Run `npm run init` first.");
    process.exit(1);
  }

  let files = getConfigFiles(machine.name, machine.config);
  files = filterConfigFiles(files, { project: options.project, globalOnly: options.globalOnly });

  let copied = 0;
  let skippedMissing = 0;
  let skippedIdentical = 0;
  const copiedRepoPaths: string[] = [];
  const verb = options.dryRun ? "would copy" : "pull";

  console.log(`${options.dryRun ? "[DRY RUN] " : ""}Pulling configs for machine: ${machine.name}\n`);

  for (const file of files) {
    if (!fileExists(file.localPath)) {
      console.log(`  skip  ${file.label} (not found locally)`);
      skippedMissing++;
      continue;
    }

    if (fileExists(file.repoPath) && filesAreIdentical(file.localPath, file.repoPath)) {
      console.log(`  same  ${file.label}`);
      skippedIdentical++;
      continue;
    }

    if (options.dryRun && fileExists(file.repoPath)) {
      const diff = getUnifiedDiff(file.repoPath, file.localPath);
      console.log(`\n--- ${file.label} ---`);
      console.log(diff || "(files differ but diff unavailable)");
    }

    if (!options.dryRun) {
      copyFileWithDir(file.localPath, file.repoPath);
      copiedRepoPaths.push(file.repoPath);
    }

    console.log(`  ${verb}  ${file.label}`);
    copied++;
  }

  console.log(`\nDone: ${copied} ${options.dryRun ? "would be copied" : "copied"}, ${skippedIdentical} unchanged, ${skippedMissing} missing locally.`);

  if (options.commit && !options.dryRun && copied > 0) {
    const repoPath = getSyncRepoPath();
    gitAdd(copiedRepoPaths, repoPath);
    const message = `Sync configs for ${machine.name} (${copied} file${copied === 1 ? "" : "s"})`;
    gitCommit(message, repoPath);
    console.log(`\nCommitted: ${message}`);
  }
}
