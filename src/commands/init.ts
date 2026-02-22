import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { hostname, homedir } from "node:os";
import { getMachineName } from "../machine.js";
import { loadConfig, saveConfig } from "../config.js";

// init uses its own ask() because it supports optional defaultValue display,
// which differs from the shared ask() in prompt.ts
function ask(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

export async function initCommand(): Promise<void> {
  const config = loadConfig();
  const defaultName = getMachineName();
  const systemHostname = hostname();

  console.log("Claude Config Sync — Machine Setup\n");

  const machineName = await ask("Machine name", defaultName);

  // Warn if the user chose a name different from the system hostname.
  // Other commands use os.hostname() for lookup, so a mismatch means the
  // machine config won't be found unless the user knows to set CLAUDE_SYNC_REPO
  // and always uses this custom name consistently.
  if (machineName !== systemHostname) {
    console.log(
      `Warning: Your system hostname is '${systemHostname}'. Using a different name means` +
        ` other commands won't find this machine unless you rename it.`,
    );
  }

  const existingConfig = config.machines[machineName];
  if (existingConfig) {
    console.log(`\nExisting config found for "${machineName}".`);
    const update = await ask("Update it? [y/N]");
    if (update.toLowerCase() !== "y" && update.toLowerCase() !== "yes") {
      console.log("Aborted.");
      return;
    }
  }

  // Use os.homedir() instead of process.env.HOME for cross-platform reliability
  const defaultGlobal = existingConfig?.globalConfigPath || `${homedir()}/.claude`;
  const globalConfigPath = await ask("Global config path (~/.claude)", defaultGlobal);

  if (!existsSync(globalConfigPath)) {
    console.log(`Warning: ${globalConfigPath} does not exist.`);
  }

  const projects: Record<string, string> = { ...(existingConfig?.projects || {}) };

  console.log("\nAdd projects to sync (leave name empty to finish):");

  if (Object.keys(projects).length > 0) {
    console.log("Current projects:");
    for (const [name, path] of Object.entries(projects)) {
      console.log(`  ${name}: ${path}`);
    }
    console.log();
  }

  while (true) {
    const name = await ask("Project name (empty to finish)");
    if (!name) break;

    const path = await ask(`  Path for "${name}"`);
    if (!path) continue;

    const resolved = resolve(path);
    if (!existsSync(resolved)) {
      console.log(`  Warning: ${resolved} does not exist.`);
    }
    projects[name] = resolved;
    console.log(`  Added: ${name} → ${resolved}`);
  }

  config.machines[machineName] = { globalConfigPath, projects };
  saveConfig(config);

  console.log(`\nSaved configuration for "${machineName}" to sync.config.json`);
  console.log(`  Global: ${globalConfigPath}`);
  console.log(`  Projects: ${Object.keys(projects).length}`);
}
