import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import {
  cancelPendingCommit,
  clearSyncConflict,
  hasSyncConflict,
} from "../src/shared/sync.ts";

const CLI_PATH = new URL("../src/main.ts", import.meta.url).pathname;

// Create isolated test directory for each test
const TEST_DIR = `/tmp/task-cli-sync-test-${Deno.pid}-${Date.now()}`;

async function runCli(
  args: string[],
  testHome?: string,
): Promise<{ stdout: string; stderr: string; code: number }> {
  const env = { ...Deno.env.toObject() };
  // Isolate HOME to prevent touching real ~/.task-cli
  env.HOME = testHome || TEST_DIR;
  env.TASK_CLI_LOG_DISABLED = "1";
  // Use in-memory DB for tests (we don't need actual task data for sync tests)
  env.TASK_CLI_DB_URL = ":memory:";

  const command = new Deno.Command("deno", {
    args: ["run", "-A", CLI_PATH, ...args],
    stdout: "piped",
    stderr: "piped",
    env,
  });

  const { code, stdout, stderr } = await command.output();

  return {
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
    code,
  };
}

async function setup(testDir: string): Promise<void> {
  await Deno.mkdir(join(testDir, ".task-cli"), { recursive: true });
}

async function teardown(testDir: string): Promise<void> {
  try {
    await Deno.remove(testDir, { recursive: true });
  } catch {
    // Ignore
  }
}

Deno.test("sync help shows subcommands", async () => {
  const testDir = `${TEST_DIR}-help`;
  await setup(testDir);
  try {
    const result = await runCli(["sync", "--help"], testDir);
    assertEquals(result.code, 0);
    assertStringIncludes(result.stdout, "init");
    assertStringIncludes(result.stdout, "status");
    assertStringIncludes(result.stdout, "pull");
    assertStringIncludes(result.stdout, "push");
  } finally {
    await teardown(testDir);
  }
});

Deno.test("sync status shows not initialized", async () => {
  const testDir = `${TEST_DIR}-status-uninit`;
  await setup(testDir);
  try {
    const result = await runCli(["sync", "status"], testDir);
    assertEquals(result.code, 0);
    assertStringIncludes(result.stdout, "Sync not initialized");
  } finally {
    await teardown(testDir);
  }
});

Deno.test("sync init creates git repo", async () => {
  const testDir = `${TEST_DIR}-init`;
  await setup(testDir);
  try {
    const result = await runCli(["sync", "init"], testDir);
    assertEquals(result.code, 0);
    assertStringIncludes(result.stdout, "Git repo initialized");

    // Verify .git exists
    const gitDir = join(testDir, ".task-cli", ".git");
    const stat = await Deno.stat(gitDir);
    assertEquals(stat.isDirectory, true);

    // Verify .gitignore exists and contains expected content
    const gitignore = await Deno.readTextFile(
      join(testDir, ".task-cli", ".gitignore"),
    );
    assertStringIncludes(gitignore, "logs/");
    assertStringIncludes(gitignore, "secrets.json");
  } finally {
    await teardown(testDir);
  }
});

Deno.test("sync status shows initialized without remote", async () => {
  const testDir = `${TEST_DIR}-status-init`;
  await setup(testDir);
  try {
    await runCli(["sync", "init"], testDir);
    const result = await runCli(["sync", "status"], testDir);
    assertEquals(result.code, 0);
    assertStringIncludes(result.stdout, "Repository: initialized");
    assertStringIncludes(result.stdout, "Remote: not configured");
  } finally {
    await teardown(testDir);
  }
});

Deno.test("sync init with remote URL sets remote", async () => {
  const testDir = `${TEST_DIR}-init-remote`;
  await setup(testDir);
  try {
    const result = await runCli(
      ["sync", "init", "https://github.com/test/repo.git"],
      testDir,
    );
    assertEquals(result.code, 0);
    assertStringIncludes(result.stdout, "Remote 'origin' set to");

    const status = await runCli(["sync", "status"], testDir);
    assertStringIncludes(status.stdout, "https://github.com/test/repo.git");
  } finally {
    await teardown(testDir);
  }
});

Deno.test("sync init on existing repo just shows message", async () => {
  const testDir = `${TEST_DIR}-init-existing`;
  await setup(testDir);
  try {
    // First init
    await runCli(["sync", "init"], testDir);

    // Second init should succeed with message
    const result = await runCli(["sync", "init"], testDir);
    assertEquals(result.code, 0);
    assertStringIncludes(result.stdout, "already initialized");
  } finally {
    await teardown(testDir);
  }
});

Deno.test("sync push fails without remote", async () => {
  const testDir = `${TEST_DIR}-push-no-remote`;
  await setup(testDir);
  try {
    await runCli(["sync", "init"], testDir);
    const result = await runCli(["sync", "push"], testDir);
    assertEquals(result.code, 1);
    assertStringIncludes(result.stderr, "No remote configured");
  } finally {
    await teardown(testDir);
  }
});

Deno.test("sync pull fails without remote", async () => {
  const testDir = `${TEST_DIR}-pull-no-remote`;
  await setup(testDir);
  try {
    await runCli(["sync", "init"], testDir);
    const result = await runCli(["sync", "pull"], testDir);
    assertEquals(result.code, 1);
    assertStringIncludes(result.stderr, "No remote configured");
  } finally {
    await teardown(testDir);
  }
});

Deno.test("sync pull fails when not initialized", async () => {
  const testDir = `${TEST_DIR}-pull-uninit`;
  await setup(testDir);
  try {
    const result = await runCli(["sync", "pull"], testDir);
    assertEquals(result.code, 1);
    assertStringIncludes(result.stderr, "Sync not initialized");
  } finally {
    await teardown(testDir);
  }
});

Deno.test("sync push fails when not initialized", async () => {
  const testDir = `${TEST_DIR}-push-uninit`;
  await setup(testDir);
  try {
    const result = await runCli(["sync", "push"], testDir);
    assertEquals(result.code, 1);
    assertStringIncludes(result.stderr, "Sync not initialized");
  } finally {
    await teardown(testDir);
  }
});

Deno.test("sync status shows dirty state after file change", async () => {
  const testDir = `${TEST_DIR}-dirty`;
  await setup(testDir);
  try {
    await runCli(["sync", "init"], testDir);

    // Add a new file
    await Deno.writeTextFile(
      join(testDir, ".task-cli", "test-file.txt"),
      "test content",
    );

    const result = await runCli(["sync", "status"], testDir);
    assertEquals(result.code, 0);
    assertStringIncludes(result.stdout, "dirty");
  } finally {
    await teardown(testDir);
  }
});

// ============================================================================
// Auto-sync unit tests
// ============================================================================

// Note: Tests for isAutoSyncEnabled/isAutoCommitEnabled are limited because
// the config module uses static paths computed at module load time. The
// auto-sync functionality is tested implicitly via the sync CLI commands
// and server/TUI lifecycle integration.

Deno.test("hasSyncConflict and clearSyncConflict work correctly", () => {
  // Initially no conflict
  clearSyncConflict();
  assertEquals(hasSyncConflict(), false);

  // Note: We can't easily test setting the conflict flag since it requires
  // actual git operations. This test just verifies the clear function works.
  clearSyncConflict();
  assertEquals(hasSyncConflict(), false);
});

Deno.test("cancelPendingCommit does not throw when no timer exists", () => {
  // Should not throw even if called multiple times
  cancelPendingCommit();
  cancelPendingCommit();
  cancelPendingCommit();
});
