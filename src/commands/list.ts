import { getCurrentMachineConfig } from "../machine.js";
import { getConfigFiles } from "../paths.js";
import { fileExists } from "../files.js";

export function listCommand(): void {
  const machine = getCurrentMachineConfig();
  if (!machine) {
    console.error("No configuration found for this machine. Run `npm run init` first.");
    process.exit(1);
  }

  const files = getConfigFiles(machine.name, machine.config);

  console.log(`Registered paths for machine: ${machine.name}\n`);
  console.log(`Global config: ${machine.config.globalConfigPath}`);
  console.log(`Projects: ${Object.keys(machine.config.projects).length}\n`);

  const maxLabel = Math.max(...files.map((f) => f.label.length));

  for (const file of files) {
    const localOk = fileExists(file.localPath) ? "+" : "-";
    const repoOk = fileExists(file.repoPath) ? "+" : "-";
    const label = file.label.padEnd(maxLabel + 2);
    console.log(`  ${label} local[${localOk}]  repo[${repoOk}]  ${file.localPath}`);
  }

  console.log(`\n  [+] exists  [-] missing`);
}
