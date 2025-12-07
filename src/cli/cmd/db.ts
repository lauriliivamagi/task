/**
 * Database management commands
 *
 * Commands for managing multiple databases (contexts).
 */

import type { Argv } from "yargs";
import { exists } from "@std/fs";
import { join } from "@std/path";
import {
  getConfig,
  getDatabaseDir,
  getDatabasesDir,
  setActiveDb,
} from "../../shared/config.ts";
import { MAX_DATABASES, MAX_DB_NAME_LENGTH } from "../../shared/limits.ts";
import {
  getActiveDbName,
  resetDbClient,
  runAllMigrations,
} from "../../db/client.ts";
import {
  ensureDatabasesDir,
  migrateToMultiDb,
} from "../../shared/migration.ts";

/** Regex for valid database names: lowercase letters, numbers, hyphens, underscores */
const DB_NAME_REGEX = /^[a-z0-9_-]+$/;

/**
 * Validate a database name.
 * Returns error message if invalid, null if valid.
 */
function validateDbName(name: string): string | null {
  if (!name || name.length === 0) {
    return "Database name is required";
  }
  if (name.length > MAX_DB_NAME_LENGTH) {
    return `Database name too long (max ${MAX_DB_NAME_LENGTH} characters)`;
  }
  if (!DB_NAME_REGEX.test(name)) {
    return "Database name can only contain lowercase letters, numbers, hyphens, and underscores";
  }
  return null;
}

/**
 * List all available databases.
 */
async function listDatabases(): Promise<
  { name: string; isActive: boolean; taskCount: number; projectCount: number }[]
> {
  const dbsDir = getDatabasesDir();

  // Load config first (populates cache for getActiveDbName)
  const config = await getConfig();

  // Ensure migration has run
  await migrateToMultiDb();
  await ensureDatabasesDir();

  const activeDb = config.activeDb ?? "default";
  const databases: {
    name: string;
    isActive: boolean;
    taskCount: number;
    projectCount: number;
  }[] = [];

  try {
    for await (const entry of Deno.readDir(dbsDir)) {
      if (entry.isDirectory) {
        const dbPath = join(dbsDir, entry.name, "data.db");
        if (await exists(dbPath)) {
          // Get stats by temporarily switching to this database
          let taskCount = 0;
          let projectCount = 0;

          try {
            // Create a temporary client for this database
            const { createClient } = await import("@libsql/client/node");
            const client = createClient({ url: `file:${dbPath}` });

            const taskResult = await client.execute(
              "SELECT COUNT(*) as count FROM tasks",
            );
            taskCount = Number(taskResult.rows[0]?.count ?? 0);

            const projectResult = await client.execute(
              "SELECT COUNT(*) as count FROM projects",
            );
            projectCount = Number(projectResult.rows[0]?.count ?? 0);

            client.close();
          } catch {
            // Database might not have tables yet
          }

          databases.push({
            name: entry.name,
            isActive: entry.name === activeDb,
            taskCount,
            projectCount,
          });
        }
      }
    }
  } catch {
    // Databases directory doesn't exist yet
  }

  // Sort alphabetically, but keep "default" first
  databases.sort((a, b) => {
    if (a.name === "default") return -1;
    if (b.name === "default") return 1;
    return a.name.localeCompare(b.name);
  });

  return databases;
}

// ========== db create ==========
interface CreateArgs {
  name: string;
}

const createCommand = {
  command: "create <name>",
  describe: "Create a new database",
  builder: (yargs: Argv) =>
    yargs.positional("name", {
      type: "string",
      describe:
        "Database name (lowercase letters, numbers, hyphens, underscores)",
      demandOption: true,
    }),
  handler: async (args: CreateArgs) => {
    try {
      const name = args.name.toLowerCase();

      // Validate name
      const error = validateDbName(name);
      if (error) {
        console.error(`Error: ${error}`);
        Deno.exit(1);
      }

      // Check max databases limit
      const existing = await listDatabases();
      if (existing.length >= MAX_DATABASES) {
        console.error(
          `Error: Maximum number of databases (${MAX_DATABASES}) reached`,
        );
        Deno.exit(1);
      }

      // Check if database already exists
      const dbDir = getDatabaseDir(name);
      if (await exists(dbDir)) {
        console.error(`Error: Database '${name}' already exists`);
        Deno.exit(1);
      }

      // Create database directory and initialize schema
      await Deno.mkdir(dbDir, { recursive: true });
      await Deno.mkdir(join(dbDir, "attachments"), { recursive: true });

      // Initialize the database with schema and all migrations
      const { createClient } = await import("@libsql/client/node");
      const { schema } = await import("../../db/schema.ts");
      const dbPath = join(dbDir, "data.db");
      const client = createClient({ url: `file:${dbPath}` });
      try {
        await client.execute("PRAGMA foreign_keys = ON;");
        await client.executeMultiple(schema);
        await runAllMigrations(client);
      } finally {
        client.close();
      }

      console.log(`Created database: ${name}`);
      console.log(`\nTo switch to this database, run:`);
      console.log(`  task db use ${name}`);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};

// ========== db list ==========
interface ListArgs {
  json?: boolean;
}

const listCommand = {
  command: "list",
  describe: "List all databases",
  builder: (yargs: Argv) =>
    yargs.option("json", {
      type: "boolean",
      describe: "Output as JSON",
    }),
  handler: async (args: ListArgs) => {
    try {
      const databases = await listDatabases();

      if (args.json) {
        console.log(JSON.stringify(databases, null, 2));
        return;
      }

      if (databases.length === 0) {
        console.log("No databases found.");
        console.log("Run 'task db create <name>' to create one.");
        return;
      }

      for (const db of databases) {
        const marker = db.isActive ? "*" : " ";
        const stats = `(${db.taskCount} tasks, ${db.projectCount} projects)`;
        console.log(`${marker} ${db.name.padEnd(20)} ${stats}`);
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};

// ========== db use ==========
interface UseArgs {
  name: string;
}

const useCommand = {
  command: "use <name>",
  describe: "Switch to a different database",
  builder: (yargs: Argv) =>
    yargs.positional("name", {
      type: "string",
      describe: "Database name to switch to",
      demandOption: true,
    }),
  handler: async (args: UseArgs) => {
    try {
      const name = args.name.toLowerCase();

      // Check if database exists
      const dbDir = getDatabaseDir(name);
      const dbPath = join(dbDir, "data.db");

      if (!(await exists(dbPath))) {
        console.error(`Error: Database '${name}' does not exist`);
        console.log("\nAvailable databases:");
        const databases = await listDatabases();
        for (const db of databases) {
          console.log(`  ${db.name}`);
        }
        Deno.exit(1);
      }

      // Check if already active
      const currentDb = getActiveDbName();
      if (currentDb === name) {
        console.log(`Already using database: ${name}`);
        return;
      }

      // Switch database
      // Note: Migrations are run on ALL databases at server startup,
      // so we don't need to run them here when switching.
      await setActiveDb(name);
      resetDbClient();

      console.log(`Switched to database: ${name}`);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};

// ========== db current ==========
interface CurrentArgs {
  json?: boolean;
}

const currentCommand = {
  command: "current",
  describe: "Show the current active database",
  builder: (yargs: Argv) =>
    yargs.option("json", {
      type: "boolean",
      describe: "Output as JSON",
    }),
  handler: async (args: CurrentArgs) => {
    try {
      // Ensure migration/setup has happened
      await migrateToMultiDb();
      await ensureDatabasesDir();

      // Load config from disk first (getActiveDbName uses cached config)
      const config = await getConfig();
      const name = config.activeDb ?? "default";
      const dbDir = getDatabaseDir(name);

      if (args.json) {
        console.log(
          JSON.stringify({
            name,
            path: dbDir,
          }),
        );
        return;
      }

      console.log(name);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};

// ========== db delete ==========
interface DeleteArgs {
  name: string;
  force?: boolean;
}

const deleteCommand = {
  command: "delete <name>",
  describe: "Delete a database",
  builder: (yargs: Argv) =>
    yargs
      .positional("name", {
        type: "string",
        describe: "Database name to delete",
        demandOption: true,
      })
      .option("force", {
        type: "boolean",
        describe: "Skip confirmation",
      }),
  handler: async (args: DeleteArgs) => {
    try {
      const name = args.name.toLowerCase();

      // Check if database exists
      const dbDir = getDatabaseDir(name);
      if (!(await exists(dbDir))) {
        console.error(`Error: Database '${name}' does not exist`);
        Deno.exit(1);
      }

      // Cannot delete the last database
      const allDatabases = await listDatabases();
      if (allDatabases.length <= 1) {
        console.error("Error: Cannot delete the last database");
        Deno.exit(1);
      }

      // Cannot delete active database
      const currentDb = getActiveDbName();
      if (currentDb === name) {
        console.error(
          `Error: Cannot delete the currently active database`,
        );
        console.error(`Switch to a different database first:`);
        console.error(`  task db use default`);
        Deno.exit(1);
      }

      // Get stats for confirmation
      const databases = await listDatabases();
      const dbInfo = databases.find((d) => d.name === name);

      if (!args.force) {
        console.log(
          `Warning: This will permanently delete all data in '${name}':`,
        );
        if (dbInfo) {
          console.log(`  - ${dbInfo.taskCount} tasks`);
          console.log(`  - ${dbInfo.projectCount} projects`);
        }

        // Count attachments
        const attachmentsDir = join(dbDir, "attachments");
        let attachmentCount = 0;
        try {
          for await (const _ of Deno.readDir(attachmentsDir)) {
            attachmentCount++;
          }
        } catch {
          // No attachments directory
        }
        if (attachmentCount > 0) {
          console.log(`  - ${attachmentCount} attachments`);
        }

        console.log(`\nType '${name}' to confirm: `);

        // Read confirmation from stdin
        const buf = new Uint8Array(1024);
        const n = await Deno.stdin.read(buf);
        if (n === null) {
          console.error("Cancelled.");
          Deno.exit(1);
        }

        const input = new TextDecoder().decode(buf.subarray(0, n)).trim();
        if (input !== name) {
          console.error("Confirmation failed. Database not deleted.");
          Deno.exit(1);
        }
      }

      // Delete the database directory
      await Deno.remove(dbDir, { recursive: true });

      console.log(`Deleted database: ${name}`);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};

// ========== db rename ==========
interface RenameArgs {
  "old-name": string;
  "new-name": string;
}

const renameCommand = {
  command: "rename <old-name> <new-name>",
  describe: "Rename a database",
  builder: (yargs: Argv) =>
    yargs
      .positional("old-name", {
        type: "string",
        describe: "Current database name",
        demandOption: true,
      })
      .positional("new-name", {
        type: "string",
        describe: "New database name",
        demandOption: true,
      }),
  handler: async (args: RenameArgs) => {
    try {
      const oldName = args["old-name"].toLowerCase();
      const newName = args["new-name"].toLowerCase();

      // Cannot rename "default"
      if (oldName === "default") {
        console.error("Error: Cannot rename the 'default' database");
        Deno.exit(1);
      }

      // Validate new name
      const error = validateDbName(newName);
      if (error) {
        console.error(`Error: ${error}`);
        Deno.exit(1);
      }

      // Check if source exists
      const oldDir = getDatabaseDir(oldName);
      if (!(await exists(oldDir))) {
        console.error(`Error: Database '${oldName}' does not exist`);
        Deno.exit(1);
      }

      // Check if target already exists
      const newDir = getDatabaseDir(newName);
      if (await exists(newDir)) {
        console.error(`Error: Database '${newName}' already exists`);
        Deno.exit(1);
      }

      // Rename directory
      await Deno.rename(oldDir, newDir);

      // If renaming the active database, update config
      const currentDb = getActiveDbName();
      if (currentDb === oldName) {
        await setActiveDb(newName);
        resetDbClient();
      }

      console.log(`Renamed database: ${oldName} -> ${newName}`);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};

// ========== Main db command ==========
export const dbCommand = {
  command: "db <command>",
  describe: "Manage databases (contexts)",
  builder: (yargs: Argv) =>
    yargs
      .command(createCommand)
      .command(listCommand)
      .command(useCommand)
      .command(currentCommand)
      .command(deleteCommand)
      .command(renameCommand)
      .demandCommand(1, "Please specify a db command"),
  handler: () => {
    // This is handled by subcommands
  },
};
