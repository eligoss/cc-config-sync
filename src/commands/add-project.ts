import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getCurrentMachineConfig, getMachineName } from "../machine.js";
import { loadConfig, saveConfig } from "../config.js";

export function addProjectCommand(name: string, projectPath: string): void {
  const config = loadConfig();
  const machineName = getMachineName();
  const machineConfig = config.machines[machineName];

  if (!machineConfig) {
    console.error(`No configuration found for machine "${machineName}". Run \`npm run init\` first.`);
    process.exit(1);
  }

  const resolved = resolve(projectPath);

  if (!existsSync(resolved)) {
    console.log(`Warning: ${resolved} does not exist.`);
  }

  if (machineConfig.projects[name]) {
    console.log(`Updating project "${name}": ${machineConfig.projects[name]} → ${resolved}`);
  } else {
    console.log(`Adding project "${name}": ${resolved}`);
  }

  machineConfig.projects[name] = resolved;
  saveConfig(config);

  console.log("Saved to sync.config.json");
}
