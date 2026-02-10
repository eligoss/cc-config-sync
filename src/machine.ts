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
