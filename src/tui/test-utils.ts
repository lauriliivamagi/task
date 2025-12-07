/**
 * TUI Test Utilities
 *
 * Helpers for testing Ink components with ink-testing-library.
 * Provides keyboard escape sequences and async frame waiting utilities.
 */

/**
 * ANSI escape sequences for keyboard input simulation.
 * Use with stdin.write() from ink-testing-library.
 *
 * @example
 * ```ts
 * stdin.write(KEYS.DOWN);
 * stdin.write(KEYS.ENTER);
 * ```
 */
export const KEYS = {
  // Arrow keys
  UP: "\x1b[A",
  DOWN: "\x1b[B",
  RIGHT: "\x1b[C",
  LEFT: "\x1b[D",

  // Common control keys
  ENTER: "\r",
  ESCAPE: "\x1b",
  TAB: "\t",
  BACKSPACE: "\x7f",
  DELETE: "\x1b[3~",
  SPACE: " ",

  // Ctrl combinations
  CTRL_C: "\x03",
  CTRL_D: "\x04",
  CTRL_U: "\x15", // Clear line

  // Function keys
  F1: "\x1bOP",
  F2: "\x1bOQ",
  F3: "\x1bOR",
  F4: "\x1bOS",

  // Home/End
  HOME: "\x1b[H",
  END: "\x1b[F",

  // Page Up/Down
  PAGE_UP: "\x1b[5~",
  PAGE_DOWN: "\x1b[6~",

  // Shift+key (uppercase for Ink's useInput)
  SHIFT_TAB: "\x1b[Z",
} as const;

/**
 * Wait for a condition in the rendered frame to become true.
 *
 * @param getFrame - Function that returns the current frame (e.g., lastFrame)
 * @param predicate - Function that returns true when the condition is met
 * @param options - Configuration options
 * @returns Promise that resolves when predicate returns true
 * @throws Error if timeout is reached before condition is met
 *
 * @example
 * ```ts
 * const { lastFrame } = render(<App />);
 * await waitForFrame(lastFrame, (f) => !f.includes("Loading"));
 * ```
 */
export async function waitForFrame(
  getFrame: () => string | undefined,
  predicate: (frame: string) => boolean,
  options: { timeout?: number; interval?: number } = {},
): Promise<string> {
  const { timeout = 5000, interval = 50 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const frame = getFrame();
    if (frame !== undefined && predicate(frame)) {
      return frame;
    }
    await delay(interval);
  }

  const lastFrame = getFrame() ?? "(no frame)";
  throw new Error(
    `Timeout waiting for frame condition after ${timeout}ms.\nLast frame:\n${lastFrame}`,
  );
}

/**
 * Wait for specific text to appear in the rendered frame.
 *
 * @param getFrame - Function that returns the current frame
 * @param text - Text to search for (case-sensitive)
 * @param options - Configuration options
 *
 * @example
 * ```ts
 * await waitForText(lastFrame, "Tasks");
 * ```
 */
export function waitForText(
  getFrame: () => string | undefined,
  text: string,
  options: { timeout?: number; interval?: number } = {},
): Promise<string> {
  return waitForFrame(getFrame, (frame) => frame.includes(text), options);
}

/**
 * Wait for text to disappear from the rendered frame.
 *
 * @param getFrame - Function that returns the current frame
 * @param text - Text that should no longer be present
 * @param options - Configuration options
 *
 * @example
 * ```ts
 * await waitForTextGone(lastFrame, "Loading");
 * ```
 */
export function waitForTextGone(
  getFrame: () => string | undefined,
  text: string,
  options: { timeout?: number; interval?: number } = {},
): Promise<string> {
  return waitForFrame(getFrame, (frame) => !frame.includes(text), options);
}

/**
 * Simple delay helper.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Strip ANSI escape codes from a string.
 * Useful for comparing text content without styling.
 *
 * @example
 * ```ts
 * const plain = stripAnsi(lastFrame());
 * assertEquals(plain.includes("Tasks"), true);
 * ```
 */
export function stripAnsi(str: string): string {
  // deno-lint-ignore no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

/**
 * Type text character by character with optional delay between keystrokes.
 * Useful for simulating realistic user typing.
 *
 * @param stdin - stdin object from ink-testing-library
 * @param text - Text to type
 * @param charDelay - Delay between characters in ms (default: 0)
 *
 * @example
 * ```ts
 * await typeText(stdin, "My new task");
 * stdin.write(KEYS.ENTER);
 * ```
 */
export async function typeText(
  stdin: { write: (data: string) => void },
  text: string,
  charDelay = 0,
): Promise<void> {
  for (const char of text) {
    stdin.write(char);
    if (charDelay > 0) {
      await delay(charDelay);
    }
  }
}

/**
 * Execute a sequence of keystrokes with optional delay.
 *
 * @param stdin - stdin object from ink-testing-library
 * @param keys - Array of keys to press (use KEYS constants)
 * @param keyDelay - Delay between keys in ms (default: 0)
 *
 * @example
 * ```ts
 * await pressKeys(stdin, [KEYS.DOWN, KEYS.DOWN, KEYS.ENTER]);
 * ```
 */
export async function pressKeys(
  stdin: { write: (data: string) => void },
  keys: string[],
  keyDelay = 0,
): Promise<void> {
  for (const key of keys) {
    stdin.write(key);
    if (keyDelay > 0) {
      await delay(keyDelay);
    }
  }
}
