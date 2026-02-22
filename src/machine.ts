import { hostname } from "node:os";
import { loadConfig } from "./config.js";
import type { MachineConfig } from "./types.js";

export function getMachineName(): string {
  return hostname();
}

export function getCurrentMachineConfig(): { name: string; config: MachineConfig } | null {
  const syncConfig = loadConfig();
  const name = getMachineName();
  const config = syncConfig.machines[name];
  if (!config) return null;
  return { name, config };
}

/**
 * Like getCurrentMachineConfig, but exits with a friendly error if no config is found.
 * Use this in commands that require a configured machine.
 */
export function requireMachineConfig(): { name: string; config: MachineConfig } {
  const machine = getCurrentMachineConfig();
  if (!machine) {
    console.error("No configuration found for this machine. Run `cc-config-sync init` first.");
    process.exit(1);
  }
  return machine;
}
