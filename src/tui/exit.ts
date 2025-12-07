/**
 * TUI Exit Handler
 *
 * Centralized exit handling for the TUI that ensures auto-sync runs on shutdown.
 */

import { isAutoSyncEnabled, syncOnShutdown } from "../shared/sync.ts";
import { logger } from "../shared/logger.ts";

/** Ink instance unmount function, set by registerInkInstance */
let unmountInk: (() => void) | null = null;

/**
 * Register the Ink instance for cleanup on exit.
 * Call this after render() in app.tsx.
 */
export function registerInkInstance(unmount: () => void): void {
  unmountInk = unmount;
}

/**
 * Exit the TUI gracefully with auto-sync.
 * This should be called instead of Deno.exit() to ensure sync happens.
 */
export async function exitTui(code = 0): Promise<never> {
  logger.info("TUI exiting...", "tui");

  // Unmount Ink first so we can print to console
  if (unmountInk) {
    unmountInk();
    unmountInk = null;
  }

  // Auto-sync: commit and push changes before shutdown (if enabled)
  if (await isAutoSyncEnabled()) {
    console.log("Syncing...");
  }
  await syncOnShutdown();

  Deno.exit(code);
}
