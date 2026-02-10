import { createInterface } from "node:readline";
import { getCurrentMachineConfig } from "../machine.js";
import { getConfigFiles } from "../paths.js";
import { fileExists, copyFileWithDir, backupFile, filesAreIdentical } from "../files.js";
import { getUnifiedDiff } from "../diff.js";
import { filterConfigFiles } from "../filter.js";

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

interface PushOptions {
  project?: string;
  globalOnly?: boolean;
  yes?: boolean;
}

export async function pushCommand(options: PushOptions): Promise<void> {
  const machine = getCurrentMachineConfig();
  if (!machine) {
    console.error("No configuration found for this machine. Run `npm run init` first.");
    process.exit(1);
  }

  let files = getConfigFiles(machine.name, machine.config);
  files = filterConfigFiles(files, { project: options.project, globalOnly: options.globalOnly });

  let pushed = 0;
  let skipped = 0;
  let applyAll = options.yes ?? false;

  console.log(`Pushing configs to machine: ${machine.name}\n`);

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

    // Show diff if local file exists
    if (fileExists(file.localPath)) {
      console.log(`\n--- Changes for ${file.label} ---`);
      const diff = getUnifiedDiff(file.localPath, file.repoPath);
      console.log(diff || "(files differ but diff unavailable)");
    } else {
      console.log(`\n  new   ${file.label} (will be created)`);
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

    // Backup existing file before overwriting
    if (fileExists(file.localPath)) {
      const backupPath = backupFile(file.localPath);
      if (backupPath) {
        console.log(`  backup → ${backupPath}`);
      }
    }

    copyFileWithDir(file.repoPath, file.localPath);
    console.log(`  push  ${file.label}`);
    pushed++;
  }

  console.log(`\nDone: ${pushed} pushed, ${skipped} skipped.`);
}
