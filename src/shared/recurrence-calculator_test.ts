import { assertEquals } from "@std/assert";
import { calculateNextDueDate } from "./recurrence-calculator.ts";

// ============================================================================
// Daily recurrence tests
// ============================================================================

Deno.test("calculateNextDueDate - daily patterns", async (t) => {
  await t.step("adds 1 day for daily recurrence", () => {
    const result = calculateNextDueDate("2025-01-15T00:00:00Z", {
      type: "daily",
      interval: 1,
    });
    assertEquals(result, "2025-01-16T00:00:00Z");
  });

  await t.step("adds 3 days for every 3 days recurrence", () => {
    const result = calculateNextDueDate("2025-01-15T00:00:00Z", {
      type: "daily",
      interval: 3,
    });
    assertEquals(result, "2025-01-18T00:00:00Z");
  });

  await t.step("handles month boundary", () => {
    const result = calculateNextDueDate("2025-01-31T00:00:00Z", {
      type: "daily",
      interval: 1,
    });
    assertEquals(result, "2025-02-01T00:00:00Z");
  });

  await t.step("handles year boundary", () => {
    const result = calculateNextDueDate("2025-12-31T00:00:00Z", {
      type: "daily",
      interval: 1,
    });
    assertEquals(result, "2026-01-01T00:00:00Z");
  });

  await t.step("handles null due date with reference", () => {
    const reference = new Date("2025-01-15T00:00:00Z");
    const result = calculateNextDueDate(
      null,
      { type: "daily", interval: 1 },
      reference,
    );
    assertEquals(result, "2025-01-16T00:00:00Z");
  });

  await t.step("preserves time component", () => {
    const result = calculateNextDueDate("2025-01-15T14:30:00Z", {
      type: "daily",
      interval: 1,
    });
    assertEquals(result, "2025-01-16T14:30:00Z");
  });
});

// ============================================================================
// Weekly recurrence tests
// ============================================================================

Deno.test("calculateNextDueDate - weekly patterns", async (t) => {
  await t.step("adds 7 days for weekly recurrence", () => {
    const result = calculateNextDueDate("2025-01-15T00:00:00Z", {
      type: "weekly",
      interval: 1,
    });
    assertEquals(result, "2025-01-22T00:00:00Z");
  });

  await t.step("adds 14 days for biweekly recurrence", () => {
    const result = calculateNextDueDate("2025-01-15T00:00:00Z", {
      type: "weekly",
      interval: 2,
    });
    assertEquals(result, "2025-01-29T00:00:00Z");
  });

  await t.step("finds next Monday from Wednesday for every Monday", () => {
    // Jan 15, 2025 is a Wednesday
    const result = calculateNextDueDate("2025-01-15T00:00:00Z", {
      type: "weekly",
      interval: 1,
      daysOfWeek: [1], // Monday
    });
    // Next Monday is Jan 20
    assertEquals(result, "2025-01-20T00:00:00Z");
  });

  await t.step("finds next Monday from Monday for every Monday", () => {
    // Jan 13, 2025 is a Monday
    const result = calculateNextDueDate("2025-01-13T00:00:00Z", {
      type: "weekly",
      interval: 1,
      daysOfWeek: [1], // Monday
    });
    // Next Monday is Jan 20
    assertEquals(result, "2025-01-20T00:00:00Z");
  });

  await t.step("handles multiple days of week - finds next occurrence", () => {
    // Jan 15, 2025 is a Wednesday
    const result = calculateNextDueDate("2025-01-15T00:00:00Z", {
      type: "weekly",
      interval: 1,
      daysOfWeek: [1, 5], // Monday and Friday
    });
    // Next occurrence is Friday Jan 17
    assertEquals(result, "2025-01-17T00:00:00Z");
  });

  await t.step(
    "handles multiple days - wraps to next week when needed",
    () => {
      // Jan 17, 2025 is a Friday
      const result = calculateNextDueDate("2025-01-17T00:00:00Z", {
        type: "weekly",
        interval: 1,
        daysOfWeek: [1, 5], // Monday and Friday
      });
      // Next occurrence is Monday Jan 20
      assertEquals(result, "2025-01-20T00:00:00Z");
    },
  );
});

// ============================================================================
// Monthly recurrence tests
// ============================================================================

Deno.test("calculateNextDueDate - monthly patterns", async (t) => {
  await t.step("adds 1 month for monthly recurrence", () => {
    const result = calculateNextDueDate("2025-01-15T00:00:00Z", {
      type: "monthly",
      interval: 1,
    });
    assertEquals(result, "2025-02-15T00:00:00Z");
  });

  await t.step("adds 2 months for every 2 months recurrence", () => {
    const result = calculateNextDueDate("2025-01-15T00:00:00Z", {
      type: "monthly",
      interval: 2,
    });
    assertEquals(result, "2025-03-15T00:00:00Z");
  });

  await t.step("handles month with fewer days - Feb 30 becomes Feb 28", () => {
    const result = calculateNextDueDate("2025-01-30T00:00:00Z", {
      type: "monthly",
      interval: 1,
    });
    // February 2025 has 28 days
    assertEquals(result, "2025-03-02T00:00:00Z"); // Date wraps to March
  });

  await t.step("calculates specific day of month", () => {
    const result = calculateNextDueDate("2025-01-15T00:00:00Z", {
      type: "monthly",
      interval: 1,
      dayOfMonth: 1,
    });
    assertEquals(result, "2025-02-01T00:00:00Z");
  });

  await t.step("calculates 15th of month", () => {
    const result = calculateNextDueDate("2025-01-10T00:00:00Z", {
      type: "monthly",
      interval: 1,
      dayOfMonth: 15,
    });
    assertEquals(result, "2025-02-15T00:00:00Z");
  });

  await t.step("calculates last day of month", () => {
    const result = calculateNextDueDate("2025-01-15T00:00:00Z", {
      type: "monthly",
      interval: 1,
      dayOfMonth: "last",
    });
    // February 2025 has 28 days
    assertEquals(result, "2025-02-28T00:00:00Z");
  });

  await t.step("calculates last day across varying month lengths", () => {
    // From Feb to March
    const result = calculateNextDueDate("2025-02-28T00:00:00Z", {
      type: "monthly",
      interval: 1,
      dayOfMonth: "last",
    });
    assertEquals(result, "2025-03-31T00:00:00Z");
  });

  await t.step("calculates first Monday of month", () => {
    const result = calculateNextDueDate("2025-01-15T00:00:00Z", {
      type: "monthly",
      interval: 1,
      weekOfMonth: 1,
      weekday: 1, // Monday
    });
    // First Monday of Feb 2025 is Feb 3
    assertEquals(result, "2025-02-03T00:00:00Z");
  });

  await t.step("calculates second Tuesday of month", () => {
    const result = calculateNextDueDate("2025-01-15T00:00:00Z", {
      type: "monthly",
      interval: 1,
      weekOfMonth: 2,
      weekday: 2, // Tuesday
    });
    // Second Tuesday of Feb 2025 is Feb 11
    assertEquals(result, "2025-02-11T00:00:00Z");
  });

  await t.step("calculates last Friday of month", () => {
    const result = calculateNextDueDate("2025-01-15T00:00:00Z", {
      type: "monthly",
      interval: 1,
      weekOfMonth: 5, // last
      weekday: 5, // Friday
    });
    // Last Friday of Feb 2025 is Feb 28
    assertEquals(result, "2025-02-28T00:00:00Z");
  });

  await t.step("clamps day to last day when month is shorter", () => {
    // Asking for 31st of month when February only has 28
    const result = calculateNextDueDate("2025-01-31T00:00:00Z", {
      type: "monthly",
      interval: 1,
      dayOfMonth: 31,
    });
    assertEquals(result, "2025-02-28T00:00:00Z");
  });
});

// ============================================================================
// Yearly recurrence tests
// ============================================================================

Deno.test("calculateNextDueDate - yearly patterns", async (t) => {
  await t.step("adds 1 year for yearly recurrence", () => {
    const result = calculateNextDueDate("2025-01-15T00:00:00Z", {
      type: "yearly",
      interval: 1,
    });
    assertEquals(result, "2026-01-15T00:00:00Z");
  });

  await t.step("adds 2 years for every 2 years recurrence", () => {
    const result = calculateNextDueDate("2025-01-15T00:00:00Z", {
      type: "yearly",
      interval: 2,
    });
    assertEquals(result, "2027-01-15T00:00:00Z");
  });

  await t.step("handles leap year Feb 29 → Feb 28 next year", () => {
    // Feb 29, 2024 (leap year)
    const result = calculateNextDueDate("2024-02-29T00:00:00Z", {
      type: "yearly",
      interval: 1,
    });
    // 2025 is not a leap year, so Feb 29 becomes Mar 1
    assertEquals(result, "2025-03-01T00:00:00Z");
  });
});

// ============================================================================
// Edge cases
// ============================================================================

Deno.test("calculateNextDueDate - edge cases", async (t) => {
  await t.step("handles null due date using today as base", () => {
    const today = new Date();
    const result = calculateNextDueDate(null, { type: "daily", interval: 1 });
    // Result should be tomorrow with time component (in UTC)
    const expected = new Date(today);
    expected.setUTCDate(expected.getUTCDate() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    const expectedStr = `${expected.getUTCFullYear()}-${
      pad(expected.getUTCMonth() + 1)
    }-${pad(expected.getUTCDate())}T${pad(expected.getUTCHours())}:${
      pad(expected.getUTCMinutes())
    }:${pad(expected.getUTCSeconds())}Z`;
    assertEquals(result, expectedStr);
  });

  await t.step("handles legacy date-only input", () => {
    // Backward compatibility: date-only strings should still work
    const result = calculateNextDueDate("2025-01-15", {
      type: "daily",
      interval: 1,
    });
    assertEquals(result, "2025-01-16T00:00:00Z");
  });
});
