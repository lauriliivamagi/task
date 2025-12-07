/**
 * Git-based state sync commands
 *
 * Syncs ~/.task-cli/ directory via git for backup and multi-machine support.
 */

import type { Argv } from "yargs";
import {
  commitChanges,
  ensureGitignore,
  getGitStatus,
  initGitRepo,
  isGitAvailable,
  isGitInitialized,
  pullChanges,
  pushChanges,
  setRemote,
} from "../../shared/sync.ts";
import { getConfig } from "../../shared/config.ts";

// ========== sync init ==========
interface InitArgs {
  "remote-url"?: string;
}

const initCommand = {
  command: "init [remote-url]",
  describe: "Initialize git repo in ~/.task-cli/",
  builder: (yargs: Argv) =>
    yargs.positional("remote-url", {
      type: "string",
      describe: "Git remote URL (e.g., git@github.com:user/task-data.git)",
    }),
  handler: async (args: InitArgs) => {
    try {
      // Check git availability
      if (!await isGitAvailable()) {
        console.error("Git is not installed or not in PATH.");
        console.error("Install git to use sync features.");
        Deno.exit(1);
      }

      // Check if already initialized
      if (await isGitInitialized()) {
        console.log("Git repo already initialized in ~/.task-cli/");

        // If remote URL provided, set it
        if (args["remote-url"]) {
          const result = await setRemote(args["remote-url"]);
          if (result.success) {
            console.log(`Remote 'origin' set to: ${args["remote-url"]}`);
          } else {
            console.error(`Failed to set remote: ${result.stderr}`);
            Deno.exit(1);
          }
        }
        return;
      }

      // Initialize new repo
      console.log("Initializing git repo in ~/.task-cli/...");
      const result = await initGitRepo();

      if (!result.success) {
        console.error(`Failed to initialize git repo: ${result.stderr}`);
        Deno.exit(1);
      }

      console.log(
        "Git repo initialized with .gitignore (excludes logs/ and secrets.json)",
      );

      // Set remote if provided
      if (args["remote-url"]) {
        const remoteResult = await setRemote(args["remote-url"]);
        if (remoteResult.success) {
          console.log(`Remote 'origin' set to: ${args["remote-url"]}`);
          console.log("\nNext steps:");
          console.log("  task sync push    # Push to remote");
        } else {
          console.error(`Failed to set remote: ${remoteResult.stderr}`);
        }
      } else {
        // Check if remote is in config
        const config = await getConfig();
        if (config.sync?.remote) {
          const remoteResult = await setRemote(config.sync.remote);
          if (remoteResult.success) {
            console.log(
              `Remote 'origin' set from config: ${config.sync.remote}`,
            );
            console.log("\nNext steps:");
            console.log("  task sync push    # Push to remote");
          }
        } else {
          console.log("\nNext steps:");
          console.log("  task sync init <remote-url>    # Add a remote");
          console.log("  or edit ~/.task-cli/config.json and set sync.remote");
        }
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};

// ========== sync status ==========
const statusCommand = {
  command: "status",
  describe: "Show sync status",
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    try {
      // Check git availability
      if (!await isGitAvailable()) {
        console.error("Git is not installed or not in PATH.");
        Deno.exit(1);
      }

      const status = await getGitStatus();

      if (!status.initialized) {
        console.log("Sync not initialized. Run: task sync init");
        return;
      }

      console.log("Sync status:");
      console.log(`  Repository: initialized`);
      console.log(`  Branch: ${status.branch || "unknown"}`);

      if (status.hasRemote) {
        console.log(`  Remote: ${status.remoteUrl}`);

        if (status.ahead > 0 || status.behind > 0) {
          console.log(
            `  Status: ${status.ahead} ahead, ${status.behind} behind`,
          );
        } else {
          console.log(`  Status: up to date`);
        }
      } else {
        console.log("  Remote: not configured");

        // Check config for remote
        const config = await getConfig();
        if (config.sync?.remote) {
          console.log(
            `  Config remote: ${config.sync.remote} (not yet added)`,
          );
          console.log(
            "\n  Run: task sync init  # to add the configured remote",
          );
        }
      }

      if (status.isDirty) {
        console.log("  Working tree: dirty (uncommitted changes)");
      } else {
        console.log("  Working tree: clean");
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};

// ========== sync pull ==========
interface PullArgs {
  force?: boolean;
}

const pullCommand = {
  command: "pull",
  describe: "Pull changes from remote",
  builder: (yargs: Argv) =>
    yargs.option("force", {
      type: "boolean",
      describe: "Force pull (may lose local changes)",
    }),
  handler: async (args: PullArgs) => {
    try {
      // Check git availability
      if (!await isGitAvailable()) {
        console.error("Git is not installed or not in PATH.");
        Deno.exit(1);
      }

      const status = await getGitStatus();

      if (!status.initialized) {
        console.error("Sync not initialized. Run: task sync init");
        Deno.exit(1);
      }

      if (!status.hasRemote) {
        console.error(
          "No remote configured. Run: task sync init <remote-url>",
        );
        Deno.exit(1);
      }

      // Warn about dirty state
      if (status.isDirty && !args.force) {
        console.error("Working tree has uncommitted changes.");
        console.error("Commit changes first with: task sync push");
        console.error("Or use --force to pull anyway (may cause conflicts).");
        Deno.exit(1);
      }

      console.log("Pulling from remote...");
      const result = await pullChanges();

      if (result.success) {
        console.log("Pull successful.");
        if (result.stdout.includes("Already up to date")) {
          console.log("Already up to date.");
        }
      } else {
        if (result.stderr.includes("CONFLICT")) {
          console.error("Merge conflict detected!");
          console.error(
            "The data.db file has conflicts that must be resolved manually.",
          );
          console.error("Consider keeping one version: local or remote.");
          Deno.exit(1);
        } else {
          console.error(`Pull failed: ${result.stderr}`);
          Deno.exit(1);
        }
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};

// ========== sync push ==========
interface PushArgs {
  message?: string;
  "no-commit"?: boolean;
}

const pushCommand = {
  command: "push",
  describe: "Push changes to remote",
  builder: (yargs: Argv) =>
    yargs
      .option("message", {
        alias: "m",
        type: "string",
        describe: "Commit message (if there are uncommitted changes)",
      })
      .option("no-commit", {
        type: "boolean",
        describe: "Push without committing current changes",
      }),
  handler: async (args: PushArgs) => {
    try {
      // Check git availability
      if (!await isGitAvailable()) {
        console.error("Git is not installed or not in PATH.");
        Deno.exit(1);
      }

      let status = await getGitStatus();

      if (!status.initialized) {
        console.error("Sync not initialized. Run: task sync init");
        Deno.exit(1);
      }

      if (!status.hasRemote) {
        // Check if remote is in config
        const config = await getConfig();
        if (config.sync?.remote) {
          console.log(`Setting remote from config: ${config.sync.remote}`);
          await setRemote(config.sync.remote);
          // Refresh status
          status = await getGitStatus();
        } else {
          console.error(
            "No remote configured. Run: task sync init <remote-url>",
          );
          Deno.exit(1);
        }
      }

      // Ensure .gitignore is up to date
      await ensureGitignore();

      // Commit if there are changes
      if (status.isDirty && !args["no-commit"]) {
        console.log("Committing changes...");
        const commitResult = await commitChanges(args.message);
        if (!commitResult.success) {
          // Check if it's because there's nothing to commit
          if (commitResult.stderr.includes("nothing to commit")) {
            console.log("No changes to commit.");
          } else {
            console.error(`Commit failed: ${commitResult.stderr}`);
            Deno.exit(1);
          }
        } else {
          console.log("Changes committed.");
        }
      }

      // Push
      console.log("Pushing to remote...");
      const pushResult = await pushChanges();

      if (pushResult.success) {
        console.log("Push successful.");
      } else {
        if (pushResult.stderr.includes("rejected")) {
          console.error("Push rejected - remote has newer changes.");
          console.error("Run 'task sync pull' first, then try push again.");
        } else if (pushResult.stderr.includes("Everything up-to-date")) {
          console.log("Everything up-to-date.");
        } else {
          console.error(`Push failed: ${pushResult.stderr}`);
        }
        Deno.exit(1);
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};

// ========== Main sync command ==========
export const syncCommand = {
  command: "sync <command>",
  describe: "Sync task data via git",
  builder: (yargs: Argv) =>
    yargs
      .command(initCommand)
      .command(statusCommand)
      .command(pullCommand)
      .command(pushCommand)
      .demandCommand(1, "Please specify a sync command"),
  handler: () => {
    // This is handled by subcommands
  },
};
