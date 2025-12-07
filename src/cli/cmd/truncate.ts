import type { Argv } from "yargs";
import { getDb } from "../../db/client.ts";

interface TruncateArgs {
  yes?: boolean;
}

export const truncateCommand = {
  command: "truncate",
  describe: "Delete all data from the database",
  builder: (yargs: Argv) =>
    yargs
      .option("yes", {
        alias: "y",
        type: "boolean",
        describe: "Skip confirmation prompt",
      }),
  handler: async (args: TruncateArgs) => {
    if (!args.yes) {
      const answer = prompt(
        "Are you sure you want to delete ALL data? This cannot be undone. (y/N)",
      );
      if (answer?.toLowerCase() !== "y") {
        console.log("Aborted.");
        return;
      }
    }

    const db = await getDb();

    // Delete in order due to foreign key constraints
    await db.execute("DELETE FROM attachments");
    await db.execute("DELETE FROM comments");
    await db.execute("DELETE FROM tasks");
    await db.execute("DELETE FROM projects");

    // Reset auto-increment counters
    await db.execute("DELETE FROM sqlite_sequence");

    console.log("All data has been deleted.");
  },
};
