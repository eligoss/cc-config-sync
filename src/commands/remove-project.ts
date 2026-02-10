import { getMachineName } from "../machine.js";
import { loadConfig, saveConfig } from "../config.js";

export function removeProjectCommand(name: string): void {
  const config = loadConfig();
  const machineName = getMachineName();
  const machineConfig = config.machines[machineName];

  if (!machineConfig) {
    console.error(`No configuration found for machine "${machineName}". Run \`npm run init\` first.`);
    process.exit(1);
  }

  if (!machineConfig.projects[name]) {
    console.error(`Project "${name}" not found for machine "${machineName}".`);
    console.log(`Available projects: ${Object.keys(machineConfig.projects).join(", ") || "(none)"}`);
    process.exit(1);
  }

  const path = machineConfig.projects[name];
  delete machineConfig.projects[name];
  saveConfig(config);

  console.log(`Removed project "${name}" (${path}) from machine "${machineName}".`);
}
