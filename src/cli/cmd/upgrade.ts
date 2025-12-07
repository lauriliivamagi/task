/**
 * Self-update command for the task CLI.
 *
 * Checks GitHub Releases for new versions and automatically downloads/installs
 * the latest Linux binary.
 */

import type { Argv } from "yargs";
import { APP_VERSION, isUpdateAvailable } from "../../shared/version.ts";
import { getLatestRelease, performUpgrade } from "../../shared/upgrade.ts";

interface UpdateArgs {
  check: boolean;
}

export const upgradeCommand = {
  command: "upgrade",
  describe: "Check for and install CLI updates from GitHub",
  builder: (yargs: Argv) =>
    yargs.option("check", {
      alias: "c",
      type: "boolean",
      default: false,
      describe: "Only check for updates, don't install",
    }),
  handler: async (args: UpdateArgs) => {
    try {
      console.log(`Current version: ${APP_VERSION}`);
      console.log("Checking for updates...");

      const release = await getLatestRelease();
      const latestVersion = release.version;

      if (!isUpdateAvailable(APP_VERSION, latestVersion)) {
        console.log(`Already on the latest version (${APP_VERSION}).`);
        return;
      }

      console.log(`New version available: ${latestVersion}`);

      if (args.check) {
        console.log("\nRun 'task update' to install the update.");
        return;
      }

      console.log(`\nUpdating from ${APP_VERSION} to ${latestVersion}...`);
      await performUpgrade(release);
    } catch (error) {
      console.error(`Update failed: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};
