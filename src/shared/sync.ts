/**
 * Git synchronization utilities for task-cli
 *
 * Provides git operations for syncing ~/.task-cli/ directory.
 * Includes auto-sync functionality for automatic sync on lifecycle events.
 */

import { join } from "@std/path";
import { exists } from "@std/fs";
import { getConfig } from "./config.ts";
import { logger } from "./logger.ts";

/** Get the config directory path (reads HOME at call time for testability) */
function getConfigDir(): string {
  return join(Deno.env.get("HOME") || ".", ".task-cli");
}

// Backwards compatibility export
const CONFIG_DIR = join(Deno.env.get("HOME") || ".", ".task-cli");

export interface GitStatus {
  initialized: boolean;
  hasRemote: boolean;
  remoteName?: string;
  remoteUrl?: string;
  isDirty: boolean;
  ahead: number;
  behind: number;
  branch?: string;
}

export interface GitResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number;
}

// .gitignore content - excludes logs and secrets
const GITIGNORE_CONTENT = `# Task - excluded from sync
logs/
secrets.json
*.log
`;

/**
 * Check if git is available on the system
 */
export async function isGitAvailable(): Promise<boolean> {
  try {
    const command = new Deno.Command("git", {
      args: ["--version"],
      stdout: "null",
      stderr: "null",
    });
    const { code } = await command.output();
    return code === 0;
  } catch {
    return false;
  }
}

/**
 * Run a git command in the config directory
 * @param args Git command arguments
 * @param timeoutMs Optional timeout in milliseconds (default: no timeout)
 */
export async function runGit(
  args: string[],
  timeoutMs?: number,
): Promise<GitResult> {
  const command = new Deno.Command("git", {
    args,
    cwd: getConfigDir(),
    stdout: "piped",
    stderr: "piped",
    env: {
      ...Deno.env.toObject(),
      GIT_TERMINAL_PROMPT: "0", // Disable interactive prompts
      GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o ConnectTimeout=10", // SSH timeout
    },
  });

  const child = command.spawn();

  if (timeoutMs) {
    const timeoutPromise = new Promise<GitResult>((resolve) => {
      setTimeout(() => {
        try {
          child.kill();
        } catch {
          // Process may have already exited
        }
        resolve({
          success: false,
          stdout: "",
          stderr: "Operation timed out",
          code: 124,
        });
      }, timeoutMs);
    });

    const resultPromise = child.output().then(({ code, stdout, stderr }) => ({
      success: code === 0,
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
      code,
    }));

    return Promise.race([resultPromise, timeoutPromise]);
  }

  const { code, stdout, stderr } = await child.output();

  return {
    success: code === 0,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
    code,
  };
}

/**
 * Check if git repo is initialized in config dir
 */
export async function isGitInitialized(): Promise<boolean> {
  const gitDir = join(getConfigDir(), ".git");
  return await exists(gitDir);
}

/**
 * Ensure .gitignore exists with correct content
 */
export async function ensureGitignore(): Promise<void> {
  const gitignorePath = join(getConfigDir(), ".gitignore");
  await Deno.writeTextFile(gitignorePath, GITIGNORE_CONTENT);
}

/**
 * Initialize git repo with .gitignore
 */
export async function initGitRepo(): Promise<GitResult> {
  // Initialize repo
  const initResult = await runGit(["init"]);
  if (!initResult.success) return initResult;

  // Configure git user if not already set (needed for commits)
  const userNameResult = await runGit(["config", "user.name"]);
  if (!userNameResult.success || !userNameResult.stdout.trim()) {
    await runGit(["config", "user.name", "task-cli"]);
  }
  const userEmailResult = await runGit(["config", "user.email"]);
  if (!userEmailResult.success || !userEmailResult.stdout.trim()) {
    await runGit(["config", "user.email", "task-cli@localhost"]);
  }

  // Create .gitignore
  await ensureGitignore();

  // Stage all files
  const addResult = await runGit(["add", "-A"]);
  if (!addResult.success) return addResult;

  // Initial commit
  return await runGit(["commit", "-m", "Initial task-cli data commit"]);
}

/**
 * Get comprehensive git status
 */
export async function getGitStatus(): Promise<GitStatus> {
  const initialized = await isGitInitialized();
  if (!initialized) {
    return {
      initialized: false,
      hasRemote: false,
      isDirty: false,
      ahead: 0,
      behind: 0,
    };
  }

  // Get current branch
  const branchResult = await runGit(["branch", "--show-current"]);
  const branch = branchResult.stdout.trim() || undefined;

  // Check for remote
  const remoteResult = await runGit(["remote", "-v"]);
  const hasRemote = remoteResult.success &&
    remoteResult.stdout.trim().length > 0;

  let remoteName: string | undefined;
  let remoteUrl: string | undefined;

  if (hasRemote) {
    const lines = remoteResult.stdout.trim().split("\n");
    if (lines.length > 0) {
      const parts = lines[0].split(/\s+/);
      remoteName = parts[0];
      remoteUrl = parts[1];
    }
  }

  // Check for dirty status
  const statusResult = await runGit(["status", "--porcelain"]);
  const isDirty = statusResult.stdout.trim().length > 0;

  // Get ahead/behind counts from cached remote tracking (no network call)
  let ahead = 0;
  let behind = 0;

  if (hasRemote && branch && remoteName) {
    // Use cached remote tracking info (no fetch - that would require network)
    const revListResult = await runGit([
      "rev-list",
      "--left-right",
      "--count",
      `${remoteName}/${branch}...HEAD`,
    ]);
    if (revListResult.success) {
      const [behindStr, aheadStr] = revListResult.stdout.trim().split(/\s+/);
      behind = parseInt(behindStr, 10) || 0;
      ahead = parseInt(aheadStr, 10) || 0;
    }
  }

  return {
    initialized,
    hasRemote,
    remoteName,
    remoteUrl,
    isDirty,
    ahead,
    behind,
    branch,
  };
}

/**
 * Set or update remote URL
 */
export async function setRemote(
  url: string,
  name = "origin",
): Promise<GitResult> {
  // Check if remote exists
  const remoteResult = await runGit(["remote", "get-url", name]);

  if (remoteResult.success) {
    // Remote exists, update it
    return await runGit(["remote", "set-url", name, url]);
  } else {
    // Remote doesn't exist, add it
    return await runGit(["remote", "add", name, url]);
  }
}

/**
 * Commit all changes
 */
export async function commitChanges(message?: string): Promise<GitResult> {
  await runGit(["add", "-A"]);
  const commitMsg = message || `Sync: ${new Date().toISOString()}`;
  return await runGit(["commit", "-m", commitMsg]);
}

// Network operation timeout (30 seconds)
const NETWORK_TIMEOUT_MS = 30000;

/**
 * Pull changes from remote
 */
export async function pullChanges(): Promise<GitResult> {
  // Pull with rebase to avoid merge commits (includes fetch)
  return await runGit(["pull", "--rebase"], NETWORK_TIMEOUT_MS);
}

/**
 * Push changes to remote
 */
export async function pushChanges(): Promise<GitResult> {
  const status = await getGitStatus();

  if (!status.branch) {
    return {
      success: false,
      stdout: "",
      stderr: "No branch detected",
      code: 1,
    };
  }

  // Set upstream if first push
  return await runGit(
    ["push", "-u", "origin", status.branch],
    NETWORK_TIMEOUT_MS,
  );
}

// ============================================================================
// Auto-sync functionality
// ============================================================================

/** Auto-sync timeout for network operations (10 seconds) */
const AUTO_SYNC_TIMEOUT_MS = 10000;

/** Debounce timer for auto-commit */
let commitTimer: number | null = null;

/** Debounce delay for auto-commit (30 seconds) */
const AUTO_COMMIT_DEBOUNCE_MS = 30000;

/** Track if we have a sync conflict */
let syncConflictDetected = false;

export interface AutoSyncResult {
  success: boolean;
  conflict?: boolean;
  error?: string;
  skipped?: boolean;
}

/**
 * Check if auto-sync is enabled.
 * Auto-sync requires both sync.auto=true in config AND a remote to be configured.
 * Disabled in test mode (TASK_CLI_SYNC_DISABLED=1 or TASK_CLI_DB_URL=:memory:).
 */
export async function isAutoSyncEnabled(): Promise<boolean> {
  // Skip sync in test mode to avoid slowing down tests
  if (
    Deno.env.get("TASK_CLI_SYNC_DISABLED") === "1" ||
    Deno.env.get("TASK_CLI_DB_URL") === ":memory:"
  ) {
    return false;
  }

  const config = await getConfig();
  if (!config.sync?.auto) {
    return false;
  }

  // Also need git initialized and remote configured
  const status = await getGitStatus();
  return status.initialized && status.hasRemote;
}

/**
 * Get the current sync conflict status
 */
export function hasSyncConflict(): boolean {
  return syncConflictDetected;
}

/**
 * Clear the sync conflict flag
 */
export function clearSyncConflict(): void {
  syncConflictDetected = false;
}

/**
 * Pull with conflict handling for auto-sync.
 * On conflict: warns and skips (does not block).
 */
export async function autoPull(): Promise<AutoSyncResult> {
  try {
    // Check if auto-sync is enabled
    if (!await isAutoSyncEnabled()) {
      return { success: true, skipped: true };
    }

    const status = await getGitStatus();

    // Check for dirty working tree (local uncommitted changes)
    if (status.isDirty) {
      logger.warn("Local changes detected, skipping auto-pull", "sync");
      return { success: true, skipped: true };
    }

    // Attempt pull with shorter timeout for auto-sync
    const result = await runGit(["pull", "--rebase"], AUTO_SYNC_TIMEOUT_MS);

    if (!result.success) {
      // Check for conflict indicators
      const isConflict = result.stderr.includes("CONFLICT") ||
        result.stderr.includes("could not apply") ||
        result.stderr.includes("Merge conflict");

      if (isConflict) {
        syncConflictDetected = true;
        logger.warn(
          "Sync conflict detected, continuing with local state. Resolve with 'task sync pull --force'",
          "sync",
        );
        // Abort the rebase to get back to clean state
        await runGit(["rebase", "--abort"]);
        return { success: false, conflict: true, error: "Merge conflict" };
      }

      // Network or other error
      logger.info(`Auto-pull skipped: ${result.stderr.trim()}`, "sync");
      return { success: false, error: result.stderr.trim() };
    }

    logger.info("Auto-pull completed successfully", "sync");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`Auto-pull failed: ${msg}`, "sync");
    return { success: false, error: msg };
  }
}

/**
 * Push with error handling for auto-sync.
 * On failure: logs warning but does not block.
 */
export async function autoPush(): Promise<AutoSyncResult> {
  try {
    // Check if auto-sync is enabled
    if (!await isAutoSyncEnabled()) {
      return { success: true, skipped: true };
    }

    const status = await getGitStatus();

    // Nothing to push if not ahead
    if (status.ahead === 0 && !status.isDirty) {
      return { success: true, skipped: true };
    }

    // Commit any pending changes first
    if (status.isDirty) {
      const commitResult = await commitChanges(
        `Auto-sync: ${new Date().toISOString()}`,
      );
      if (!commitResult.success) {
        logger.warn(
          `Auto-commit failed: ${commitResult.stderr.trim()}`,
          "sync",
        );
        return { success: false, error: commitResult.stderr.trim() };
      }
    }

    // Push with shorter timeout
    const result = await runGit(
      ["push", "-u", "origin", status.branch || "main"],
      AUTO_SYNC_TIMEOUT_MS,
    );

    if (!result.success) {
      logger.warn(`Auto-push failed: ${result.stderr.trim()}`, "sync");
      return { success: false, error: result.stderr.trim() };
    }

    logger.info("Auto-push completed successfully", "sync");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`Auto-push failed: ${msg}`, "sync");
    return { success: false, error: msg };
  }
}

/**
 * Sync on startup: pulls latest changes if auto-sync is enabled.
 * Safe to call even if auto-sync is disabled (will no-op).
 */
export async function syncOnStartup(): Promise<void> {
  if (!await isAutoSyncEnabled()) {
    return;
  }

  logger.info("Running auto-sync on startup...", "sync");
  await autoPull();
}

/**
 * Sync on shutdown: commits and pushes changes if auto-sync is enabled.
 * Safe to call even if auto-sync is disabled (will no-op).
 */
export async function syncOnShutdown(): Promise<void> {
  // Cancel any pending debounced commits
  cancelPendingCommit();

  if (!await isAutoSyncEnabled()) {
    return;
  }

  logger.info("Running auto-sync on shutdown...", "sync");
  await autoPush();
}

/**
 * Schedule an auto-commit after a period of inactivity.
 * Call this after any write operation.
 * Uses debouncing to batch multiple writes into a single commit.
 */
export function scheduleAutoCommit(): void {
  // Check synchronously if we should even bother
  // (async check happens in the timeout callback)
  if (commitTimer !== null) {
    clearTimeout(commitTimer);
  }

  commitTimer = setTimeout(async () => {
    commitTimer = null;

    if (!await isAutoSyncEnabled()) {
      return;
    }

    const status = await getGitStatus();
    if (!status.isDirty) {
      return;
    }

    const result = await commitChanges(
      `Auto-commit: ${new Date().toISOString()}`,
    );
    if (result.success) {
      logger.info("Auto-commit completed", "sync");
    } else {
      logger.warn(`Auto-commit failed: ${result.stderr.trim()}`, "sync");
    }
  }, AUTO_COMMIT_DEBOUNCE_MS);

  // Unref the timer so it doesn't prevent the process from exiting.
  // This is important for CLI commands that complete quickly.
  Deno.unrefTimer(commitTimer);
}

/**
 * Cancel any pending auto-commit.
 * Call this before manual commits or shutdown.
 */
export function cancelPendingCommit(): void {
  if (commitTimer !== null) {
    clearTimeout(commitTimer);
    commitTimer = null;
  }
}

export { CONFIG_DIR };
