import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { AssertionError } from "@std/assert";
import { assertResolves, assertResolvesTo } from "./test-utils.ts";

// Helper to create resolving/rejecting promises
const resolveWith = <T>(value: T): Promise<T> => Promise.resolve(value);
const rejectWith = (message: string): Promise<never> =>
  Promise.reject(new Error(message));

// =============================================================================
// assertResolves
// =============================================================================

Deno.test("assertResolves - passes for resolving promises", async () => {
  const result = await assertResolves(resolveWith(42));
  assertEquals(result, 42);
});

Deno.test("assertResolves - returns the resolved value", async () => {
  const obj = { name: "test", value: 123 };
  const result = await assertResolves(resolveWith(obj));
  assertEquals(result, obj);
});

Deno.test("assertResolves - passes for promises that resolve to undefined", async () => {
  const result = await assertResolves(resolveWith(undefined));
  assertEquals(result, undefined);
});

Deno.test("assertResolves - passes for promises that resolve to null", async () => {
  const result = await assertResolves(resolveWith(null));
  assertEquals(result, null);
});

Deno.test("assertResolves - throws AssertionError for rejecting promises", async () => {
  await assertRejects(
    () => assertResolves(rejectWith("something went wrong")),
    AssertionError,
    "Expected promise to resolve, but it rejected with: something went wrong",
  );
});

Deno.test("assertResolves - uses custom message when provided", async () => {
  await assertRejects(
    () => assertResolves(rejectWith("error"), "custom failure message"),
    AssertionError,
    "custom failure message",
  );
});

Deno.test("assertResolves - handles non-Error rejections", async () => {
  const error = await assertRejects(
    () => assertResolves(Promise.reject("string rejection")),
    AssertionError,
  );
  assertStringIncludes(error.message, "string rejection");
});

// =============================================================================
// assertResolvesTo
// =============================================================================

Deno.test("assertResolvesTo - passes when value matches", async () => {
  await assertResolvesTo(resolveWith(42), 42);
  await assertResolvesTo(resolveWith("hello"), "hello");
  await assertResolvesTo(resolveWith(true), true);
});

Deno.test("assertResolvesTo - passes for complex objects", async () => {
  const expected = { id: 1, items: [1, 2, 3] };
  await assertResolvesTo(resolveWith(expected), expected);
});

Deno.test("assertResolvesTo - throws AssertionError when value doesn't match", async () => {
  await assertRejects(
    () => assertResolvesTo(resolveWith(42), 100),
    AssertionError,
  );
});

Deno.test("assertResolvesTo - throws AssertionError when promise rejects", async () => {
  await assertRejects(
    () => assertResolvesTo(rejectWith("failed"), 42),
    AssertionError,
    "Expected promise to resolve, but it rejected with: failed",
  );
});

Deno.test("assertResolvesTo - uses custom message for rejection", async () => {
  await assertRejects(
    () => assertResolvesTo(rejectWith("error"), 42, "operation should succeed"),
    AssertionError,
    "operation should succeed",
  );
});
