/**
 * TUI State Persistence
 *
 * Persists TUI state (like last selected task) between sessions.
 * Stores data in the active database's directory: ~/.task-cli/databases/{name}/tui-state.json
 *
 * Uses the filesystem abstraction for testability - can be tested with
 * MemoryFS or AgentFS instead of the real filesystem.
 */

import { join } from "@std/path";
import { getDbDir } from "../db/client.ts";
import { type FileSystem, getFS } from "../shared/fs-abstraction.ts";

/**
 * Get the path to the TUI state file for the active database.
 */
export function getStateFile(): string {
  return join(getDbDir(), "tui-state.json");
}

/**
 * TUI state schema.
 */
export interface TuiState {
  lastSelectedTaskId: number | null;
}

/**
 * Default state values.
 */
export const DEFAULT_STATE: TuiState = {
  lastSelectedTaskId: null,
};

/**
 * Load TUI state from disk.
 * Returns default state if file doesn't exist or is invalid.
 *
 * @param fs - Optional filesystem to use (defaults to global filesystem)
 * @param stateFile - Optional path to state file (defaults to getStateFile())
 */
export async function loadTuiState(
  fs?: FileSystem,
  stateFile?: string,
): Promise<TuiState> {
  const filesystem = fs ?? getFS();
  const path = stateFile ?? getStateFile();

  try {
    const content = await filesystem.readTextFile(path);
    const parsed = JSON.parse(content);

    const state: TuiState = { ...DEFAULT_STATE };

    if (typeof parsed.lastSelectedTaskId === "number") {
      state.lastSelectedTaskId = parsed.lastSelectedTaskId;
    }

    return state;
  } catch {
    // File doesn't exist or is invalid - use defaults
    return { ...DEFAULT_STATE };
  }
}

/**
 * Save TUI state to disk.
 * Creates the directory if it doesn't exist.
 *
 * @param state - Partial state to merge with existing state
 * @param fs - Optional filesystem to use (defaults to global filesystem)
 * @param stateFile - Optional path to state file (defaults to getStateFile())
 */
export async function saveTuiState(
  state: Partial<TuiState>,
  fs?: FileSystem,
  stateFile?: string,
): Promise<void> {
  const filesystem = fs ?? getFS();
  const path = stateFile ?? getStateFile();

  try {
    const stateDir = path.substring(0, path.lastIndexOf("/"));
    await filesystem.ensureDir(stateDir);

    // Merge with existing state to preserve other fields
    const existing = await loadTuiState(filesystem, path);
    const newState = { ...existing, ...state };

    await filesystem.writeTextFile(
      path,
      JSON.stringify(newState, null, 2) + "\n",
    );
  } catch {
    // Silently fail - state persistence is not critical
  }
}

/**
 * Save the last selected task ID.
 * Fire-and-forget operation.
 *
 * @param taskId - Task ID to save, or null to clear
 * @param fs - Optional filesystem to use
 * @param stateFile - Optional path to state file
 */
export function saveLastSelectedTaskId(
  taskId: number | null,
  fs?: FileSystem,
  stateFile?: string,
): void {
  // Fire-and-forget - don't await
  saveTuiState({ lastSelectedTaskId: taskId }, fs, stateFile);
}

/**
 * Get the last selected task ID.
 *
 * @param fs - Optional filesystem to use
 * @param stateFile - Optional path to state file
 */
export async function getLastSelectedTaskId(
  fs?: FileSystem,
  stateFile?: string,
): Promise<number | null> {
  const state = await loadTuiState(fs, stateFile);
  return state.lastSelectedTaskId;
}
