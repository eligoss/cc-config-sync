import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { getMachineName } from "../machine.js";
import { loadConfig, saveConfig, getConfigsDir } from "../config.js";
import { ask } from "../prompt.js";

export async function removeProjectCommand(name: string): Promise<void> {
  const config = loadConfig();
  const machineName = getMachineName();
  const machineConfig = config.machines[machineName];

  if (!machineConfig) {
    console.error(
      `No configuration found for machine "${machineName}". Run \`cc-config-sync init\` first.`,
    );
    process.exit(1);
  }

  if (!machineConfig.projects[name]) {
    console.error(`Project "${name}" not found for machine "${machineName}".`);
    console.log(
      `Available projects: ${Object.keys(machineConfig.projects).join(", ") || "(none)"}`,
    );
    process.exit(1);
  }

  const path = machineConfig.projects[name];
  delete machineConfig.projects[name];
  saveConfig(config);

  console.log(`Removed project "${name}" (${path}) from machine "${machineName}".`);

  // Offer to delete the corresponding directory in the sync repo
  const repoProjectDir = join(getConfigsDir(), machineName, "projects", name);
  if (existsSync(repoProjectDir)) {
    const answer = await ask(`\nAlso delete repo directory ${repoProjectDir}? [y/N] `);
    if (answer === "y" || answer === "yes") {
      rmSync(repoProjectDir, { recursive: true });
      console.log(`Deleted ${repoProjectDir}`);
    } else {
      console.log("Repo directory kept.");
    }
  }
}
