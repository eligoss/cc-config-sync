import { Command } from "commander";
import { setSyncRepoPath } from "./config.js";
import { pullCommand } from "./commands/pull.js";
import { pushCommand } from "./commands/push.js";
import { statusCommand } from "./commands/status.js";
import { listCommand } from "./commands/list.js";
import { initCommand } from "./commands/init.js";
import { addProjectCommand } from "./commands/add-project.js";
import { removeProjectCommand } from "./commands/remove-project.js";
import { renameProjectCommand } from "./commands/rename-project.js";
import { cleanBackupsCommand } from "./commands/clean-backups.js";
import { version } from "./version.js";

const program = new Command();

program
  .name("cc-config-sync")
  .description("Sync Claude Code configurations across machines")
  .version(version)
  .option("--repo <path>", "Path to the sync repo (or set CLAUDE_SYNC_REPO env var)")
  .hook("preAction", () => {
    const repoPath = program.opts().repo || process.env.CLAUDE_SYNC_REPO;
    if (!repoPath) {
      console.error(
        "Error: sync repo path required. Use --repo <path> or set CLAUDE_SYNC_REPO env var.",
      );
      process.exit(1);
    }
    setSyncRepoPath(repoPath);
  });

program
  .command("pull")
  .description("Copy local configs into the repo")
  .option("-p, --project <name>", "Only pull configs for a specific project")
  .option("--global-only", "Only pull global configs")
  .option("--dry-run", "Show what would be copied without copying")
  .option("--commit", "Git add and commit pulled files")
  .action(pullCommand);

program
  .command("push")
  .description("Copy repo configs to local machine")
  .option("-p, --project <name>", "Only push configs for a specific project")
  .option("--global-only", "Only push global configs")
  .option("-y, --yes", "Apply all changes without prompting")
  .option("--dry-run", "Show what would be applied without copying files or creating backups")
  .action(pushCommand);

program
  .command("status")
  .description("Show differences between local and repo configs")
  .option("-v, --verbose", "Show diffs for modified files")
  .option("-a, --all", "Show all entries including missing-both")
  .option("-p, --project <name>", "Only show status for a specific project")
  .option("--global-only", "Only show status for global configs")
  .action(statusCommand);

program.command("list").description("Show all registered paths").action(listCommand);

program.command("init").description("Interactive setup for current machine").action(initCommand);

program
  .command("add-project")
  .description("Add a project to track")
  .argument("<name>", "Project name")
  .argument("<path>", "Absolute path to project root")
  .action(addProjectCommand);

program
  .command("remove-project")
  .description("Remove a project from tracking")
  .argument("<name>", "Project name")
  .action(removeProjectCommand);

program
  .command("rename-project")
  .description("Rename a tracked project")
  .argument("<old-name>", "Current project name")
  .argument("<new-name>", "New project name")
  .action(renameProjectCommand);

program
  .command("clean-backups")
  .description("Find and delete backup files created by push")
  .action(cleanBackupsCommand);

program.parse();
