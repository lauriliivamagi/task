import { assertEquals, assertThrows } from "@std/assert";
import {
  assert,
  assertDefined,
  assertInRange,
  assertInteger,
  AssertionError,
  assertNonEmpty,
  assertNonEmptyString,
  assertNonNegative,
  assertOneOf,
  assertPositive,
  unreachable,
} from "./assert.ts";

Deno.test("assert - passes for truthy values", () => {
  assert(true, "should pass");
  assert(1, "should pass");
  assert("string", "should pass");
  assert({}, "should pass");
  assert([], "should pass");
});

Deno.test("assert - throws AssertionError for falsy values", () => {
  assertThrows(
    () => assert(false, "condition failed"),
    AssertionError,
    "condition failed",
  );
  assertThrows(
    () => assert(0, "zero is falsy"),
    AssertionError,
    "zero is falsy",
  );
  assertThrows(
    () => assert("", "empty string is falsy"),
    AssertionError,
    "empty string is falsy",
  );
  assertThrows(
    () => assert(null, "null is falsy"),
    AssertionError,
    "null is falsy",
  );
  assertThrows(
    () => assert(undefined, "undefined is falsy"),
    AssertionError,
    "undefined is falsy",
  );
});

Deno.test("AssertionError - includes context and data", () => {
  try {
    assert(false, "test message", "test-context", { key: "value" });
  } catch (e) {
    const error = e as AssertionError;
    assertEquals(error.name, "AssertionError");
    assertEquals(error.message, "test message");
    assertEquals(error.context, "test-context");
    assertEquals(error.data, { key: "value" });
  }
});

Deno.test("assertDefined - passes for defined values", () => {
  assertDefined(0, "zero is defined");
  assertDefined("", "empty string is defined");
  assertDefined(false, "false is defined");
  assertDefined({}, "object is defined");
});

Deno.test("assertDefined - throws for null or undefined", () => {
  assertThrows(
    () => assertDefined(null, "null is not defined"),
    AssertionError,
    "null is not defined",
  );
  assertThrows(
    () => assertDefined(undefined, "undefined is not defined"),
    AssertionError,
    "undefined is not defined",
  );
});

Deno.test("assertInteger - passes for integers", () => {
  assertInteger(0, "zero is integer");
  assertInteger(1, "positive integer");
  assertInteger(-1, "negative integer");
  assertInteger(1000000, "large integer");
});

Deno.test("assertInteger - throws for non-integers", () => {
  assertThrows(
    () => assertInteger(1.5, "decimal is not integer"),
    AssertionError,
    "decimal is not integer",
  );
  assertThrows(
    () => assertInteger(NaN, "NaN is not integer"),
    AssertionError,
    "NaN is not integer",
  );
  assertThrows(
    () => assertInteger(Infinity, "Infinity is not integer"),
    AssertionError,
    "Infinity is not integer",
  );
});

Deno.test("assertPositive - passes for positive numbers", () => {
  assertPositive(1, "one is positive");
  assertPositive(0.5, "half is positive");
  assertPositive(1000000, "large number is positive");
});

Deno.test("assertPositive - throws for zero and negative", () => {
  assertThrows(
    () => assertPositive(0, "zero is not positive"),
    AssertionError,
    "zero is not positive",
  );
  assertThrows(
    () => assertPositive(-1, "negative is not positive"),
    AssertionError,
    "negative is not positive",
  );
});

Deno.test("assertNonNegative - passes for zero and positive", () => {
  assertNonNegative(0, "zero is non-negative");
  assertNonNegative(1, "positive is non-negative");
  assertNonNegative(0.5, "decimal is non-negative");
});

Deno.test("assertNonNegative - throws for negative", () => {
  assertThrows(
    () => assertNonNegative(-1, "negative fails"),
    AssertionError,
    "negative fails",
  );
  assertThrows(
    () => assertNonNegative(-0.5, "negative decimal fails"),
    AssertionError,
    "negative decimal fails",
  );
});

Deno.test("assertInRange - passes for values in range", () => {
  assertInRange(5, 0, 10, "5 is in 0-10");
  assertInRange(0, 0, 10, "0 is in 0-10 (inclusive)");
  assertInRange(10, 0, 10, "10 is in 0-10 (inclusive)");
  assertInRange(-5, -10, 0, "-5 is in -10 to 0");
});

Deno.test("assertInRange - throws for values out of range", () => {
  assertThrows(
    () => assertInRange(-1, 0, 10, "-1 is below range"),
    AssertionError,
    "-1 is below range",
  );
  assertThrows(
    () => assertInRange(11, 0, 10, "11 is above range"),
    AssertionError,
    "11 is above range",
  );
});

Deno.test("assertNonEmpty - passes for non-empty arrays", () => {
  assertNonEmpty([1], "array with one element");
  assertNonEmpty([1, 2, 3], "array with multiple elements");
});

Deno.test("assertNonEmpty - throws for empty arrays", () => {
  assertThrows(
    () => assertNonEmpty([], "empty array fails"),
    AssertionError,
    "empty array fails",
  );
});

Deno.test("assertNonEmptyString - passes for non-empty strings", () => {
  assertNonEmptyString("hello", "non-empty string");
  assertNonEmptyString("  hello  ", "string with whitespace");
  assertNonEmptyString("x", "single character");
});

Deno.test("assertNonEmptyString - throws for empty or whitespace strings", () => {
  assertThrows(
    () => assertNonEmptyString("", "empty string fails"),
    AssertionError,
    "empty string fails",
  );
  assertThrows(
    () => assertNonEmptyString("   ", "whitespace-only string fails"),
    AssertionError,
    "whitespace-only string fails",
  );
  assertThrows(
    () => assertNonEmptyString("\t\n", "tabs and newlines only fails"),
    AssertionError,
    "tabs and newlines only fails",
  );
});

Deno.test("assertOneOf - passes for allowed values", () => {
  assertOneOf("a", ["a", "b", "c"], "a is in list");
  assertOneOf(1, [1, 2, 3], "1 is in list");
  assertOneOf("pending", ["pending", "done"], "pending is valid status");
});

Deno.test("assertOneOf - throws for disallowed values", () => {
  assertThrows(
    () => assertOneOf("d", ["a", "b", "c"], "d is not in list"),
    AssertionError,
    "d is not in list",
  );
  assertThrows(
    () => assertOneOf(4, [1, 2, 3], "4 is not in list"),
    AssertionError,
    "4 is not in list",
  );
});

Deno.test("unreachable - always throws", () => {
  assertThrows(
    () => unreachable("should not reach here"),
    AssertionError,
    "Unreachable: should not reach here",
  );
});

Deno.test("unreachable - includes context and data", () => {
  try {
    unreachable("test", "context", { extra: "data" });
  } catch (e) {
    const error = e as AssertionError;
    assertEquals(error.context, "context");
    assertEquals(error.data, { extra: "data" });
  }
});
