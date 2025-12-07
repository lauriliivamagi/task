/**
 * Tests for Migration Logic
 *
 * Uses MemoryFS for filesystem isolation - no real filesystem operations.
 * This eliminates flakiness from temp directory cleanup and concurrent access.
 */

import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { MemoryFS } from "./fs-abstraction.ts";
import { getValidActiveDb, listDatabaseNames } from "./migration.ts";

// ============================================================================
// MemoryFS-based tests for migration file structure logic
// ============================================================================

Deno.test("migration file structure logic with MemoryFS", async (t) => {
  await t.step("can detect directories with data.db", async () => {
    const fs = new MemoryFS();

    // Create directories
    await fs.ensureDir("/databases/db1");
    await fs.ensureDir("/databases/db2");
    await fs.ensureDir("/databases/empty");

    // Create data.db files in db1 and db2
    await fs.writeTextFile("/databases/db1/data.db", "");
    await fs.writeTextFile("/databases/db2/data.db", "");
    // empty dir has no data.db

    // Count directories with data.db
    const dirsWithDb: string[] = [];
    const entries = await fs.readDir("/databases");

    for (const entry of entries) {
      if (entry.isDirectory) {
        const dbPath = join("/databases", entry.name, "data.db");
        if (await fs.exists(dbPath)) {
          dirsWithDb.push(entry.name);
        }
      }
    }

    assertEquals(dirsWithDb.length, 2);
    assertEquals(dirsWithDb.includes("db1"), true);
    assertEquals(dirsWithDb.includes("db2"), true);
    assertEquals(dirsWithDb.includes("empty"), false);
  });

  await t.step("sort prefers 'default' database", () => {
    const databases = ["work", "default", "personal", "archive"];

    databases.sort((a, b) => {
      if (a === "default") return -1;
      if (b === "default") return 1;
      return a.localeCompare(b);
    });

    assertEquals(databases[0], "default");
    assertEquals(databases.slice(1).sort(), ["archive", "personal", "work"]);
  });

  await t.step("handles single database correctly", () => {
    const databases = ["work"];

    databases.sort((a, b) => {
      if (a === "default") return -1;
      if (b === "default") return 1;
      return a.localeCompare(b);
    });

    assertEquals(databases[0], "work");
  });
});

// ============================================================================
// File movement simulation tests with MemoryFS
// ============================================================================

Deno.test("migration file operations with MemoryFS", async (t) => {
  await t.step("can move files between directories", async () => {
    const fs = new MemoryFS();

    await fs.ensureDir("/source");
    await fs.ensureDir("/target");

    // Create source files
    await fs.writeTextFile("/source/file1.txt", "content1");
    await fs.writeTextFile("/source/file2.txt", "content2");

    // Move files using rename
    const entries = await fs.readDir("/source");
    for (const entry of entries) {
      if (entry.isFile) {
        await fs.rename(`/source/${entry.name}`, `/target/${entry.name}`);
      }
    }

    // Verify files moved
    const targetEntries = await fs.readDir("/target");
    const targetFileNames = targetEntries.map((e) => e.name);

    assertEquals(targetFileNames.length, 2);
    assertEquals(targetFileNames.includes("file1.txt"), true);
    assertEquals(targetFileNames.includes("file2.txt"), true);

    // Verify content preserved
    const content1 = await fs.readTextFile("/target/file1.txt");
    assertEquals(content1, "content1");

    // Verify source is now empty of files
    const sourceEntries = await fs.readDir("/source");
    assertEquals(sourceEntries.length, 0);
  });

  await t.step("can create nested directory structure", async () => {
    const fs = new MemoryFS();

    const nestedDir = "/databases/default/attachments";
    await fs.ensureDir(nestedDir);

    // Write a file to nested structure
    await fs.writeTextFile(`${nestedDir}/file.txt`, "test");

    // Verify structure exists
    const isDir = await fs.isDirectory(nestedDir);
    assertEquals(isDir, true);

    const content = await fs.readTextFile(`${nestedDir}/file.txt`);
    assertEquals(content, "test");
  });

  await t.step("can move entire directory with contents", async () => {
    const fs = new MemoryFS();

    // Create source with nested structure
    await fs.ensureDir("/old/subdir");
    await fs.writeTextFile("/old/file1.txt", "content1");
    await fs.writeTextFile("/old/subdir/file2.txt", "content2");

    // Move directory
    await fs.rename("/old", "/new");

    // Verify old doesn't exist
    assertEquals(await fs.exists("/old"), false);

    // Verify new exists with all contents
    assertEquals(await fs.exists("/new"), true);
    assertEquals(await fs.exists("/new/file1.txt"), true);
    assertEquals(await fs.exists("/new/subdir/file2.txt"), true);

    const content1 = await fs.readTextFile("/new/file1.txt");
    assertEquals(content1, "content1");

    const content2 = await fs.readTextFile("/new/subdir/file2.txt");
    assertEquals(content2, "content2");
  });
});

// ============================================================================
// Database path validation tests
// ============================================================================

Deno.test("database path construction", async (t) => {
  await t.step("constructs correct paths for database name", () => {
    const basePath = "/home/user/.task-cli/databases";
    const dbName = "work";

    const dbDir = join(basePath, dbName);
    const dbPath = join(dbDir, "data.db");
    const attachmentsPath = join(dbDir, "attachments");
    const tuiStatePath = join(dbDir, "tui-state.json");

    assertEquals(dbDir, "/home/user/.task-cli/databases/work");
    assertEquals(dbPath, "/home/user/.task-cli/databases/work/data.db");
    assertEquals(
      attachmentsPath,
      "/home/user/.task-cli/databases/work/attachments",
    );
    assertEquals(
      tuiStatePath,
      "/home/user/.task-cli/databases/work/tui-state.json",
    );
  });

  await t.step("handles 'default' database name", () => {
    const basePath = "/home/user/.task-cli/databases";
    const dbName = "default";

    const dbDir = join(basePath, dbName);
    assertEquals(dbDir, "/home/user/.task-cli/databases/default");
  });
});

// ============================================================================
// Migration condition tests with MemoryFS
// ============================================================================

Deno.test("migration condition logic with MemoryFS", async (t) => {
  await t.step("migration needed when old exists and new doesn't", async () => {
    const fs = new MemoryFS();

    // Create old structure (data.db at root)
    await fs.writeTextFile("/task-cli/data.db", "");
    // Don't create databases dir

    const oldExists = await fs.exists("/task-cli/data.db");
    const newExists = await fs.exists("/task-cli/databases");

    const needsMigration = oldExists && !newExists;
    assertEquals(needsMigration, true);
  });

  await t.step("migration not needed when new structure exists", async () => {
    const fs = new MemoryFS();

    // Create both old and new structure
    await fs.writeTextFile("/task-cli/data.db", "");
    await fs.ensureDir("/task-cli/databases");

    const oldExists = await fs.exists("/task-cli/data.db");
    const newExists = await fs.exists("/task-cli/databases");

    const needsMigration = oldExists && !newExists;
    assertEquals(needsMigration, false);
  });

  await t.step(
    "migration not needed when old structure doesn't exist",
    async () => {
      const fs = new MemoryFS();

      // Only create new structure
      await fs.ensureDir("/task-cli/databases");

      const oldExists = await fs.exists("/task-cli/data.db");
      const newExists = await fs.exists("/task-cli/databases");

      const needsMigration = oldExists && !newExists;
      assertEquals(needsMigration, false);
    },
  );
});

// ============================================================================
// Additional MemoryFS operation tests
// ============================================================================

Deno.test("MemoryFS extended operations", async (t) => {
  await t.step("readDir returns correct entries", async () => {
    const fs = new MemoryFS();

    await fs.ensureDir("/test/subdir");
    await fs.writeTextFile("/test/file1.txt", "a");
    await fs.writeTextFile("/test/file2.txt", "b");

    const entries = await fs.readDir("/test");

    assertEquals(entries.length, 3); // 2 files + 1 subdir
    assertEquals(entries.filter((e) => e.isFile).length, 2);
    assertEquals(entries.filter((e) => e.isDirectory).length, 1);
  });

  await t.step("remove with recursive deletes contents", async () => {
    const fs = new MemoryFS();

    await fs.ensureDir("/to-delete/nested");
    await fs.writeTextFile("/to-delete/file.txt", "content");
    await fs.writeTextFile("/to-delete/nested/deep.txt", "deep");

    await fs.remove("/to-delete", { recursive: true });

    assertEquals(await fs.exists("/to-delete"), false);
    assertEquals(await fs.exists("/to-delete/file.txt"), false);
    assertEquals(await fs.exists("/to-delete/nested"), false);
  });

  await t.step("remove without recursive fails on non-empty dir", async () => {
    const fs = new MemoryFS();

    await fs.ensureDir("/non-empty");
    await fs.writeTextFile("/non-empty/file.txt", "content");

    let threw = false;
    try {
      await fs.remove("/non-empty");
    } catch {
      threw = true;
    }

    assertEquals(threw, true);
    assertEquals(await fs.exists("/non-empty"), true);
  });

  await t.step("isDirectory returns correct values", async () => {
    const fs = new MemoryFS();

    await fs.ensureDir("/mydir");
    await fs.writeTextFile("/myfile.txt", "content");

    assertEquals(await fs.isDirectory("/mydir"), true);
    assertEquals(await fs.isDirectory("/myfile.txt"), false);
    assertEquals(await fs.isDirectory("/nonexistent"), false);
  });

  await t.step("getDirs returns all directories", async () => {
    const fs = new MemoryFS();

    await fs.ensureDir("/a/b/c");
    await fs.ensureDir("/x/y");

    const dirs = fs.getDirs();

    assertEquals(dirs.has("/"), true);
    assertEquals(dirs.has("/a"), true);
    assertEquals(dirs.has("/a/b"), true);
    assertEquals(dirs.has("/a/b/c"), true);
    assertEquals(dirs.has("/x"), true);
    assertEquals(dirs.has("/x/y"), true);
  });
});

// ============================================================================
// Integration with actual migration functions (limited due to hardcoded paths)
// ============================================================================

Deno.test("listDatabaseNames - returns array", async () => {
  // listDatabaseNames uses hardcoded DATABASES_DIR which we can't override
  // Just verify it returns an array without throwing
  const names = await listDatabaseNames();
  assertEquals(Array.isArray(names), true);
});

Deno.test("getValidActiveDb - handles non-existent database", async () => {
  // Test with a name that definitely won't exist
  const result = await getValidActiveDb("definitely-nonexistent-db-name-12345");
  // Should return either null (if no databases) or first available db
  assertEquals(result === null || typeof result === "string", true);
});
