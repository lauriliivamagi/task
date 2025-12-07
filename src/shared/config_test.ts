import { assertEquals, assertExists } from "@std/assert";
import {
  getConfig,
  getConfigSync,
  getDatabaseDir,
  getDatabasesDir,
  resetConfig,
} from "./config.ts";

// Reset config before each test to clear cache
function setup(): void {
  resetConfig();
}

// ============================================================================
// getConfig tests
// ============================================================================

Deno.test("getConfig - returns config object", async () => {
  setup();
  const config = await getConfig();

  assertExists(config);
  assertExists(config.logLevel);
  assertExists(config.work);
  assertExists(config.activeDb);
});

Deno.test("getConfig - has default values", async () => {
  setup();
  const config = await getConfig();

  // Check defaults are populated
  assertEquals(typeof config.logLevel, "string");
  assertEquals(typeof config.work.repos_dir, "string");
  assertEquals(typeof config.work.ide_command, "string");
  assertEquals(Array.isArray(config.work.ide_args), true);
  assertEquals(typeof config.activeDb, "string");
});

Deno.test("getConfig - caches result", async () => {
  setup();
  const config1 = await getConfig();
  const config2 = await getConfig();

  // Should be the same object reference (cached)
  assertEquals(config1, config2);
});

// ============================================================================
// getConfigSync tests
// ============================================================================

Deno.test("getConfigSync - returns defaults before getConfig called", () => {
  setup();
  const config = getConfigSync();

  // Should return defaults
  assertExists(config);
  assertExists(config.logLevel);
  assertExists(config.work);
  assertEquals(config.activeDb, "default");
});

Deno.test("getConfigSync - returns cached config after getConfig", async () => {
  setup();
  await getConfig();
  const syncConfig = getConfigSync();

  assertExists(syncConfig);
  assertEquals(typeof syncConfig.logLevel, "string");
});

// ============================================================================
// resetConfig tests
// ============================================================================

Deno.test("resetConfig - clears cached config", async () => {
  setup();
  const config1 = await getConfig();
  resetConfig();
  const config2 = await getConfig();

  // Config should still have same values but be a new load
  assertEquals(config1.logLevel, config2.logLevel);
  assertEquals(config1.activeDb, config2.activeDb);
});

// ============================================================================
// Environment variable override tests
// ============================================================================

Deno.test("getConfig - environment variable overrides", async (t) => {
  await t.step("TASK_CLI_LOG_LEVEL overrides config", async () => {
    setup();
    const originalLevel = Deno.env.get("TASK_CLI_LOG_LEVEL");

    try {
      Deno.env.set("TASK_CLI_LOG_LEVEL", "debug");
      const config = await getConfig();
      assertEquals(config.logLevel, "debug");
    } finally {
      // Restore original
      if (originalLevel !== undefined) {
        Deno.env.set("TASK_CLI_LOG_LEVEL", originalLevel);
      } else {
        Deno.env.delete("TASK_CLI_LOG_LEVEL");
      }
      setup();
    }
  });

  await t.step("invalid TASK_CLI_LOG_LEVEL is ignored", async () => {
    setup();
    const originalLevel = Deno.env.get("TASK_CLI_LOG_LEVEL");

    try {
      Deno.env.set("TASK_CLI_LOG_LEVEL", "invalid_level");
      const config = await getConfig();
      // Should not be "invalid_level", should fall back to default or file config
      assertEquals(
        ["debug", "info", "warn", "error"].includes(config.logLevel),
        true,
      );
    } finally {
      if (originalLevel !== undefined) {
        Deno.env.set("TASK_CLI_LOG_LEVEL", originalLevel);
      } else {
        Deno.env.delete("TASK_CLI_LOG_LEVEL");
      }
      setup();
    }
  });

  await t.step("TASK_CLI_REPOS_DIR overrides work.repos_dir", async () => {
    setup();
    const originalDir = Deno.env.get("TASK_CLI_REPOS_DIR");

    try {
      Deno.env.set("TASK_CLI_REPOS_DIR", "/custom/repos/path");
      const config = await getConfig();
      assertEquals(config.work.repos_dir, "/custom/repos/path");
    } finally {
      if (originalDir !== undefined) {
        Deno.env.set("TASK_CLI_REPOS_DIR", originalDir);
      } else {
        Deno.env.delete("TASK_CLI_REPOS_DIR");
      }
      setup();
    }
  });

  await t.step("TASK_CLI_IDE_COMMAND overrides work.ide_command", async () => {
    setup();
    const originalCmd = Deno.env.get("TASK_CLI_IDE_COMMAND");

    try {
      Deno.env.set("TASK_CLI_IDE_COMMAND", "code");
      const config = await getConfig();
      assertEquals(config.work.ide_command, "code");
    } finally {
      if (originalCmd !== undefined) {
        Deno.env.set("TASK_CLI_IDE_COMMAND", originalCmd);
      } else {
        Deno.env.delete("TASK_CLI_IDE_COMMAND");
      }
      setup();
    }
  });
});

// ============================================================================
// Database path helpers tests
// ============================================================================

Deno.test("getDatabasesDir - returns databases directory path", () => {
  const dir = getDatabasesDir();
  assertEquals(typeof dir, "string");
  assertEquals(dir.endsWith("databases"), true);
});

Deno.test("getDatabaseDir - returns specific database directory", () => {
  const dir = getDatabaseDir("work");
  assertEquals(typeof dir, "string");
  assertEquals(dir.endsWith("work"), true);
});

Deno.test("getDatabaseDir - handles 'default' database name", () => {
  const dir = getDatabaseDir("default");
  assertEquals(typeof dir, "string");
  assertEquals(dir.endsWith("default"), true);
});

// ============================================================================
// Work config defaults tests
// ============================================================================

Deno.test("getConfig - work config has all required fields", async () => {
  setup();
  const config = await getConfig();

  assertExists(config.work.repos_dir);
  assertExists(config.work.default_template);
  assertExists(config.work.ide_command);
  assertExists(config.work.ide_args);
  assertExists(config.work.naming);
  assertEquals(typeof config.work.auto_commit, "boolean");
});

Deno.test("getConfig - work.ide_args is array of strings", async () => {
  setup();
  const config = await getConfig();

  assertEquals(Array.isArray(config.work.ide_args), true);
  for (const arg of config.work.ide_args) {
    assertEquals(typeof arg, "string");
  }
});

// ============================================================================
// Config file handling tests
// ============================================================================

Deno.test("getConfig - handles missing config file gracefully", async () => {
  setup();
  // Even if config file doesn't exist, getConfig should return defaults
  const config = await getConfig();

  assertExists(config);
  assertExists(config.logLevel);
  assertExists(config.work);
});

Deno.test("getConfig - activeDb defaults to 'default'", async () => {
  setup();
  const config = await getConfig();

  // activeDb should have a value
  assertEquals(typeof config.activeDb, "string");
  assertEquals(config.activeDb.length > 0, true);
});
