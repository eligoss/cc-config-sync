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
