import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getMachineName } from "../machine.js";
import { loadConfig, saveConfig } from "../config.js";
import { isValidProjectName } from "../validation.js";

export function addProjectCommand(name: string, projectPath: string): void {
  if (!isValidProjectName(name)) {
    console.error(
      `Invalid project name "${name}". Names must be non-empty and must not contain ` +
        `'/', '\\\\', or '..'.`,
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
