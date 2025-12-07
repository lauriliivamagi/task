// TigerStyle assertions for larr-task.
// Assertions detect programmer errors. Unlike operating errors (expected),
// assertion failures are unexpected. The only correct way to handle corrupt
// code is to crash. Assertions downgrade catastrophic correctness bugs into
// liveness bugs.

import { logger } from "./logger.ts";

/**
 * Error thrown when an assertion fails.
 * Contains context and data for debugging.
 */
export class AssertionError extends Error {
  constructor(
    message: string,
    public readonly context?: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AssertionError";
  }
}

/**
 * Assert that a condition is truthy.
 * Logs the failure and throws AssertionError if condition is falsy.
 *
 * @param condition - The condition to check.
 * @param message - Description of what was expected.
 * @param context - Optional context identifier (e.g., "db", "sdk").
 * @param data - Optional data to include in the log.
 */
export function assert(
  condition: unknown,
  message: string,
  context?: string,
  data?: Record<string, unknown>,
): asserts condition {
  if (!condition) {
    logger.error(`Assertion failed: ${message}`, context ?? "assert", data);
    throw new AssertionError(message, context, data);
  }
}

/**
 * Assert that a value is neither null nor undefined.
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message: string,
  context?: string,
): asserts value is T {
  assert(value !== null && value !== undefined, message, context, { value });
}

/**
 * Assert that a number is an integer.
 */
export function assertInteger(
  value: number,
  message: string,
  context?: string,
): asserts value {
  assert(Number.isInteger(value), message, context, { value });
}

/**
 * Assert that a number is positive (> 0).
 */
export function assertPositive(
  value: number,
  message: string,
  context?: string,
): asserts value {
  assert(value > 0, message, context, { value });
}

/**
 * Assert that a number is non-negative (>= 0).
 */
export function assertNonNegative(
  value: number,
  message: string,
  context?: string,
): asserts value {
  assert(value >= 0, message, context, { value });
}

/**
 * Assert that a number is within a range [min, max] inclusive.
 */
export function assertInRange(
  value: number,
  min: number,
  max: number,
  message: string,
  context?: string,
): asserts value {
  assert(value >= min && value <= max, message, context, { value, min, max });
}

/**
 * Assert that an array is not empty.
 */
export function assertNonEmpty<T>(
  arr: T[],
  message: string,
  context?: string,
): asserts arr is [T, ...T[]] {
  assert(arr.length > 0, message, context, { length: arr.length });
}

/**
 * Assert that a string is not empty (after trimming whitespace).
 */
export function assertNonEmptyString(
  value: string,
  message: string,
  context?: string,
): asserts value {
  assert(value.trim().length > 0, message, context, { value });
}

/**
 * Assert that a value is one of the allowed values.
 */
export function assertOneOf<T>(
  value: T,
  allowed: readonly T[],
  message: string,
  context?: string,
): asserts value {
  assert(allowed.includes(value), message, context, {
    value,
    allowed: allowed.slice(0, 10),
  });
}

/**
 * Always fails. Use for unreachable code paths.
 * TypeScript will infer the return type as `never`.
 */
export function unreachable(
  message: string,
  context?: string,
  data?: Record<string, unknown>,
): never {
  logger.error(`Unreachable code: ${message}`, context ?? "assert", data);
  throw new AssertionError(`Unreachable: ${message}`, context, data);
}
