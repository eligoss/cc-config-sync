import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { getMachineName } from "../machine.js";
import { loadConfig, saveConfig, getConfigsDir } from "../config.js";
import { isValidProjectName } from "../validation.js";

export function renameProjectCommand(oldName: string, newName: string): void {
  if (!isValidProjectName(oldName)) {
    console.error(
      `Invalid old project name "${oldName}". Names must be non-empty and must not contain` +
        ` '/', '\\\\', or '..'.`,
    );
    process.exit(1);
  }

  if (!isValidProjectName(newName)) {
    console.error(
      `Invalid new project name "${newName}". Names must be non-empty and must not contain` +
        ` '/', '\\\\', or '..'.`,
    );
    process.exit(1);
  }

  const config = loadConfig();
  const machineName = getMachineName();
  const machineConfig = config.machines[machineName];

  if (!machineConfig) {
    console.error(
      `No configuration found for machine "${machineName}". Run \`cc-config-sync init\` first.`,
    );
    process.exit(1);
  }

  if (!machineConfig.projects[oldName]) {
    console.error(`Project "${oldName}" not found for machine "${machineName}".`);
    console.log(
      `Available projects: ${Object.keys(machineConfig.projects).join(", ") || "(none)"}`,
    );
    process.exit(1);
  }

  if (machineConfig.projects[newName]) {
    console.error(
      `Project "${newName}" already exists for machine "${machineName}". Choose a different name.`,
    );
    process.exit(1);
  }

  // Update config: move project path under new name
  machineConfig.projects[newName] = machineConfig.projects[oldName];
  delete machineConfig.projects[oldName];
  saveConfig(config);

  console.log(`Renamed project "${oldName}" → "${newName}" in sync.config.json`);

  // Rename corresponding directory in the sync repo if it exists
  const configsDir = getConfigsDir();
  const oldDir = join(configsDir, machineName, "projects", oldName);
  const newDir = join(configsDir, machineName, "projects", newName);

  if (existsSync(oldDir)) {
    if (existsSync(newDir)) {
      console.error(
        `Cannot rename repo directory: ${newDir} already exists. Please resolve manually.`,
      );
      process.exit(1);
    }
    renameSync(oldDir, newDir);
    console.log(`Renamed repo directory: ${oldDir} → ${newDir}`);
  }
}
