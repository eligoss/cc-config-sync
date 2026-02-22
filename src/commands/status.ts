import { requireMachineConfig } from "../machine.js";
import { getConfigFiles } from "../paths.js";
import { compareFile } from "../diff.js";
import { filterConfigFiles } from "../filter.js";
import type { FileStatus } from "../types.js";

const STATUS_ICONS: Record<FileStatus, string> = {
  identical: "  =  ",
  modified: " [M] ",
  "local-only": " [L] ",
  "repo-only": " [R] ",
  "missing-both": " [?] ",
};

const STATUS_DESCRIPTIONS: Record<FileStatus, string> = {
  identical: "identical",
  modified: "modified",
  "local-only": "local only (not in repo)",
  "repo-only": "repo only (not on disk)",
  "missing-both": "missing everywhere",
};

interface StatusOptions {
  verbose?: boolean;
  all?: boolean;
  project?: string;
  globalOnly?: boolean;
}

export function statusCommand(options: StatusOptions): void {
  const machine = requireMachineConfig();

  let files = getConfigFiles(machine.name, machine.config);
  files = filterConfigFiles(files, { project: options.project, globalOnly: options.globalOnly });

  const results = files.map(compareFile);

  console.log(`Status for machine: ${machine.name}\n`);

  const counts: Record<FileStatus, number> = {
    identical: 0,
    modified: 0,
    "local-only": 0,
    "repo-only": 0,
    "missing-both": 0,
  };

  let hiddenCount = 0;

  for (const result of results) {
    counts[result.status]++;

    if (result.status === "missing-both" && !options.all) {
      hiddenCount++;
      continue;
    }

    let suffix = "";
    if (result.status === "modified" && result.newerSide) {
      suffix = ` (${result.newerSide} newer)`;
    }

    console.log(`${STATUS_ICONS[result.status]} ${result.file.label}${suffix}`);

    if (options.verbose && result.diff) {
      console.log(result.diff);
    }
  }

  console.log("\nSummary:");
  for (const [status, count] of Object.entries(counts)) {
    if (count > 0) {
      console.log(`  ${count} ${STATUS_DESCRIPTIONS[status as FileStatus]}`);
    }
  }

  if (hiddenCount > 0) {
    console.log(`\n  (${hiddenCount} missing-both hidden, use --all to show)`);
  }
}
