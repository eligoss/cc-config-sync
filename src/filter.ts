import type { ConfigFile } from "./types.js";

export interface FilterOptions {
  project?: string;
  globalOnly?: boolean;
}

export function filterConfigFiles(files: ConfigFile[], options: FilterOptions): ConfigFile[] {
  if (options.project && options.globalOnly) {
    console.error("Error: --project and --global-only cannot be used together.");
    process.exit(1);
  }

  if (options.globalOnly) {
    return files.filter((f) => f.label.startsWith("global/"));
  }

  if (options.project) {
    const prefix = `projects/${options.project}/`;
    const matched = files.filter((f) => f.label.startsWith(prefix));
    if (matched.length === 0) {
      console.error(`Error: no config files found for project "${options.project}".`);
      process.exit(1);
    }
    return matched;
  }

  return files;
}
