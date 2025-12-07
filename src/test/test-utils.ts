// Test utilities for async assertions.
// These complement Deno's @std/assert by providing better error messages
// when testing promises (inspired by Jest's .resolves/.rejects pattern).

import { assertEquals, AssertionError } from "@std/assert";

/**
 * Assert that a promise resolves successfully (doesn't reject).
 * Returns the resolved value for further assertions.
 *
 * Unlike `await promise`, this provides a clear error message if
 * the promise rejects: "Expected promise to resolve, but it rejected with: ..."
 *
 * @example
 * ```ts
 * const result = await assertResolves(fetchUser("123"));
 * assertEquals(result.name, "Alice");
 * ```
 */
export async function assertResolves<T>(
  promise: Promise<T>,
  msg?: string,
): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new AssertionError(
      msg ?? `Expected promise to resolve, but it rejected with: ${errorMsg}`,
    );
  }
}

/**
 * Assert that a promise resolves to a specific value.
 * Combines assertResolves with assertEquals for convenience.
 *
 * @example
 * ```ts
 * await assertResolvesTo(fetchStatus(), "ok");
 * await assertResolvesTo(computeSum(1, 2), 3);
 * ```
 */
export async function assertResolvesTo<T>(
  promise: Promise<T>,
  expected: T,
  msg?: string,
): Promise<void> {
  const actual = await assertResolves(promise, msg);
  assertEquals(actual, expected, msg);
}
