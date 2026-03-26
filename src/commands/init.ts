import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { hostname, homedir } from "node:os";
import { getMachineName } from "../machine.js";
import { loadConfig, saveConfig } from "../config.js";
import { setBackupsEnabled, getBackupsEnabled } from "../user-config.js";
import { isNonInteractive } from "../cli-utils.js";

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

export interface InitOptions {
  nonInteractive?: boolean;
  machineName?: string;
  globalPath?: string;
  backup?: boolean;
  project?: string[];
}

/**
 * Parse a "name:path" string, splitting on the first colon only.
 * Returns [name, path] or null if the format is invalid.
 */
function parseProjectArg(value: string): [string, string] | null {
  const colonIndex = value.indexOf(":");
  if (colonIndex === -1) return null;
  const name = value.slice(0, colonIndex);
  const path = value.slice(colonIndex + 1);
  if (!name || !path) return null;
  return [name, resolve(path)];
}

export async function initCommand(options: InitOptions = {}): Promise<void> {
  const config = loadConfig();
  const systemHostname = hostname();

  if (isNonInteractive(options)) {
    // --- Non-interactive mode ---
    if (!options.machineName) {
      console.error("Error: --machine-name is required in non-interactive mode");
      process.exit(1);
      return;
    }

    const machineName = options.machineName;
    const existingConfig = config.machines[machineName];

    // Resolve values: explicit flag > existing config > default
    const globalConfigPath =
      options.globalPath ?? existingConfig?.globalConfigPath ?? `${homedir()}/.claude`;

    if (!existsSync(globalConfigPath)) {
      console.log(`Warning: ${globalConfigPath} does not exist.`);
    }

    // Parse projects from --project flags
    const projects: Record<string, string> = { ...(existingConfig?.projects || {}) };
    if (options.project) {
      for (const projectArg of options.project) {
        const parsed = parseProjectArg(projectArg);
        if (!parsed) {
          console.error(`Error: Invalid --project format "${projectArg}", expected name:path`);
          process.exit(1);
          return;
        }
        const [name, path] = parsed;
        if (!existsSync(path)) {
          console.log(`Warning: ${path} does not exist.`);
        }
        projects[name] = path;
      }
    }

    // Resolve backup setting: explicit flag > existing setting > default (true)
    if (options.backup !== undefined) {
      setBackupsEnabled(options.backup);
    } else if (!existingConfig) {
      setBackupsEnabled(true);
    }
    // If existingConfig exists and no explicit flag, preserve existing backup setting

    config.machines[machineName] = { globalConfigPath, projects };
    saveConfig(config);

    const backupsEnabled = getBackupsEnabled();
    console.log(`Saved configuration for "${machineName}" to sync.config.json`);
    console.log(`  Global: ${globalConfigPath}`);
    console.log(`  Projects: ${Object.keys(projects).length}`);
    console.log(`  Backups: ${backupsEnabled ? "enabled" : "disabled"}`);
    return;
  }

  // --- Interactive mode (original behavior) ---
  const defaultName = getMachineName();

  console.log("Claude Config Sync — Machine Setup\n");

  const machineName = await ask("Machine name", defaultName);

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

  const defaultGlobal = existingConfig?.globalConfigPath || `${homedir()}/.claude`;
  const globalConfigPath = await ask("Global config path (~/.claude)", defaultGlobal);

  if (!existsSync(globalConfigPath)) {
    console.log(`Warning: ${globalConfigPath} does not exist.`);
  }

  const existingBackupsEnabled = getBackupsEnabled();
  const backupAnswer = await ask(
    "Back up local files before pushing?",
    existingBackupsEnabled ? "Y" : "n",
  );
  const backupsEnabled = backupAnswer.toLowerCase() !== "n" && backupAnswer.toLowerCase() !== "no";

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
  setBackupsEnabled(backupsEnabled);

  console.log(`\nSaved configuration for "${machineName}" to sync.config.json`);
  console.log(`  Global: ${globalConfigPath}`);
  console.log(`  Projects: ${Object.keys(projects).length}`);
  console.log(`  Backups: ${backupsEnabled ? "enabled" : "disabled"}`);
}
