import { Command } from "commander";

/**
 * Returns true if `cmd` is the "config" command or any of its subcommands.
 * Commander fires preAction with the leaf subcommand (e.g. "set-repo"), not the
 * parent "config", so we must walk the parent chain.
 */
export function isConfigSubcommand(cmd: Command): boolean {
  let node: Command | null = cmd;
  while (node) {
    if (node.name() === "config") return true;
    node = node.parent;
  }
  return false;
}

/**
 * Returns true if the CLI is running in non-interactive mode.
 * Triggered by the --non-interactive flag or a truthy CI environment variable.
 */
export function isNonInteractive(options: { nonInteractive?: boolean }): boolean {
  return options.nonInteractive === true || !!process.env.CI;
}
