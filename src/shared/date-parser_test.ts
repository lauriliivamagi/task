import { assertEquals, assertNotEquals, assertThrows } from "@std/assert";
import { AssertionError } from "./assert.ts";
import {
  formatDateTimeForEditing,
  formatPeriodLabel,
  getReportPeriodRange,
  normalizeDateToDateTime,
  parseNaturalDate,
  resolveDueDate,
} from "./date-parser.ts";

// Helper: Convert local date components to expected UTC ISO string
// This accounts for the timezone offset so tests work in any timezone
function localToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): string {
  const localDate = new Date(year, month - 1, day, hour, minute, 0);
  return localDate.toISOString();
}

// ============================================================================
// parseNaturalDate tests
// ============================================================================

Deno.test("parseNaturalDate - basic patterns", async (t) => {
  // Use a fixed reference date for deterministic tests
  const reference = new Date("2025-01-15T10:00:00Z");

  await t.step("parses 'tomorrow' to next day at midnight", () => {
    const result = parseNaturalDate("tomorrow", reference);
    // chrono parses relative to local date of reference; tomorrow = Jan 16 at local midnight
    assertEquals(result, localToUtc(2025, 1, 16));
  });

  await t.step("parses 'today' to current day at midnight", () => {
    const result = parseNaturalDate("today", reference);
    assertEquals(result, localToUtc(2025, 1, 15));
  });

  await t.step("parses 'in 3 days' correctly", () => {
    const result = parseNaturalDate("in 3 days", reference);
    assertEquals(result, localToUtc(2025, 1, 18));
  });

  await t.step("parses absolute date 'December 25, 2025'", () => {
    const result = parseNaturalDate("December 25, 2025", reference);
    assertEquals(result, localToUtc(2025, 12, 25));
  });

  await t.step("parses 'next Monday' correctly", () => {
    // Jan 15, 2025 is a Wednesday, "next Monday" in chrono means the following week's Monday (Jan 20)
    const result = parseNaturalDate("next Monday", reference);
    assertEquals(result, localToUtc(2025, 1, 20));
  });

  await t.step("parses 'Friday' correctly (this week)", () => {
    // Jan 15, 2025 is a Wednesday, Friday this week is Jan 17
    const result = parseNaturalDate("Friday", reference);
    assertEquals(result, localToUtc(2025, 1, 17));
  });

  await t.step("parses 'next Friday' correctly", () => {
    // Jan 15, 2025 is a Wednesday, "next Friday" in chrono means the following week's Friday (Jan 24)
    const result = parseNaturalDate("next Friday", reference);
    assertEquals(result, localToUtc(2025, 1, 24));
  });
});

Deno.test("parseNaturalDate - time preservation", async (t) => {
  const reference = new Date("2025-01-15T10:00:00Z");

  await t.step("parses 'tomorrow at 15:00' with time", () => {
    const result = parseNaturalDate("tomorrow at 15:00", reference);
    assertEquals(result, localToUtc(2025, 1, 16, 15, 0));
  });

  await t.step("parses 'tomorrow at 14:30' with 24h time", () => {
    const result = parseNaturalDate("tomorrow at 14:30", reference);
    assertEquals(result, localToUtc(2025, 1, 16, 14, 30));
  });

  await t.step("parses 'next Monday 9:00' with time", () => {
    const result = parseNaturalDate("next Monday 9:00", reference);
    assertEquals(result, localToUtc(2025, 1, 20, 9, 0));
  });
});

Deno.test("parseNaturalDate - invalid input", async (t) => {
  await t.step("returns null for invalid input", () => {
    const result = parseNaturalDate("xyzzy gibberish");
    assertEquals(result, null);
  });

  await t.step("throws AssertionError for empty string", () => {
    assertThrows(() => parseNaturalDate(""), AssertionError);
  });

  await t.step("throws AssertionError for whitespace only", () => {
    assertThrows(() => parseNaturalDate("   "), AssertionError);
  });
});

Deno.test("parseNaturalDate - month boundaries", async (t) => {
  await t.step("handles 'in 3 days' crossing month boundary", () => {
    const ref = new Date("2025-01-30T00:00:00Z");
    const result = parseNaturalDate("in 3 days", ref);
    assertEquals(result, localToUtc(2025, 2, 2));
  });

  await t.step("handles 'in 1 week' crossing month boundary", () => {
    const ref = new Date("2025-01-28T00:00:00Z");
    const result = parseNaturalDate("in 1 week", ref);
    assertEquals(result, localToUtc(2025, 2, 4));
  });
});

// ============================================================================
// normalizeDateToDateTime tests
// ============================================================================

Deno.test("normalizeDateToDateTime - date-only formats", async (t) => {
  await t.step("date-only becomes midnight UTC", () => {
    const result = normalizeDateToDateTime("2025-12-15");
    assertEquals(result, "2025-12-15T00:00:00Z");
  });

  await t.step("another date-only example", () => {
    const result = normalizeDateToDateTime("2024-06-01");
    assertEquals(result, "2024-06-01T00:00:00Z");
  });
});

Deno.test("normalizeDateToDateTime - UTC passthrough", async (t) => {
  await t.step("already UTC stays unchanged", () => {
    const result = normalizeDateToDateTime("2025-12-15T14:30:00Z");
    assertEquals(result, "2025-12-15T14:30:00Z");
  });

  await t.step("UTC with milliseconds stays unchanged", () => {
    const result = normalizeDateToDateTime("2025-12-15T14:30:00.000Z");
    assertEquals(result, "2025-12-15T14:30:00.000Z");
  });
});

Deno.test("normalizeDateToDateTime - local time conversion", async (t) => {
  await t.step("datetime with T (no Z) converts to UTC", () => {
    const result = normalizeDateToDateTime("2025-12-15T14:30:00");
    // Result depends on local timezone, but should have Z suffix
    assertEquals(result.endsWith("Z"), true);
    assertNotEquals(result, "2025-12-15T14:30:00"); // Should be different
  });

  await t.step("space-separated datetime converts to UTC", () => {
    const result = normalizeDateToDateTime("2025-12-15 14:30");
    assertEquals(result.endsWith("Z"), true);
  });

  await t.step("space-separated with seconds converts to UTC", () => {
    const result = normalizeDateToDateTime("2025-12-15 14:30:45");
    assertEquals(result.endsWith("Z"), true);
  });
});

// ============================================================================
// formatDateTimeForEditing tests
// ============================================================================

Deno.test("formatDateTimeForEditing - UTC to local", async (t) => {
  await t.step("formats UTC datetime for editing", () => {
    const result = formatDateTimeForEditing("2025-12-15T14:30:00Z");
    // Result format should be "YYYY-MM-DD HH:MM"
    assertEquals(
      result.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/) !== null,
      true,
    );
  });

  await t.step("returns empty string for empty input", () => {
    const result = formatDateTimeForEditing("");
    assertEquals(result, "");
  });

  await t.step("returns empty string for invalid date", () => {
    const result = formatDateTimeForEditing("not-a-date");
    assertEquals(result, "");
  });

  await t.step("handles UTC datetime with milliseconds", () => {
    const result = formatDateTimeForEditing("2025-12-15T14:30:00.000Z");
    assertEquals(
      result.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/) !== null,
      true,
    );
  });
});

// ============================================================================
// resolveDueDate tests
// ============================================================================

Deno.test("resolveDueDate - priority handling", async (t) => {
  await t.step("ISO date takes precedence over natural", () => {
    const result = resolveDueDate("2025-12-15", "tomorrow");
    assertEquals(result, "2025-12-15T00:00:00Z");
  });

  await t.step("uses natural language when no ISO date", () => {
    const result = resolveDueDate(undefined, "tomorrow");
    // Should be tomorrow's date (depends on current time)
    assertEquals(result !== null, true);
    assertEquals(result?.endsWith("Z"), true);
  });

  await t.step("returns null when neither provided", () => {
    const result = resolveDueDate(undefined, undefined);
    assertEquals(result, null);
  });

  await t.step("returns null for invalid natural language", () => {
    const result = resolveDueDate(undefined, "xyzzy invalid");
    assertEquals(result, null);
  });
});

// ============================================================================
// getReportPeriodRange tests
// ============================================================================

Deno.test("getReportPeriodRange - week", async (t) => {
  await t.step("week spans Monday to Sunday", () => {
    // Jan 15, 2025 is a Wednesday
    const ref = new Date("2025-01-15T10:00:00Z");
    const result = getReportPeriodRange("week", ref);
    assertEquals(result.from, "2025-01-13"); // Monday
    assertEquals(result.to, "2025-01-19"); // Sunday
  });

  await t.step("week label format for same month", () => {
    const ref = new Date("2025-01-15T10:00:00Z");
    const result = getReportPeriodRange("week", ref);
    assertEquals(result.label, "Week of Jan 13-19, 2025");
  });

  await t.step("week spanning month boundary has correct label", () => {
    // Jan 30, 2025 - week spans Jan 27 - Feb 2
    const ref = new Date("2025-01-30T10:00:00Z");
    const result = getReportPeriodRange("week", ref);
    assertEquals(result.from, "2025-01-27");
    assertEquals(result.to, "2025-02-02");
    assertEquals(result.label, "Week of Jan 27 - Feb 2, 2025");
  });
});

Deno.test("getReportPeriodRange - month", async (t) => {
  await t.step("month spans first to last day", () => {
    const ref = new Date("2025-01-15T10:00:00Z");
    const result = getReportPeriodRange("month", ref);
    assertEquals(result.from, "2025-01-01");
    assertEquals(result.to, "2025-01-31");
    assertEquals(result.label, "January 2025");
  });

  await t.step("February in non-leap year", () => {
    const ref = new Date("2025-02-15T10:00:00Z");
    const result = getReportPeriodRange("month", ref);
    assertEquals(result.from, "2025-02-01");
    assertEquals(result.to, "2025-02-28");
    assertEquals(result.label, "February 2025");
  });

  await t.step("February in leap year", () => {
    const ref = new Date("2024-02-15T10:00:00Z");
    const result = getReportPeriodRange("month", ref);
    assertEquals(result.from, "2024-02-01");
    assertEquals(result.to, "2024-02-29");
    assertEquals(result.label, "February 2024");
  });
});

Deno.test("getReportPeriodRange - quarter", async (t) => {
  await t.step("Q1 spans Jan 1 to Mar 31", () => {
    const ref = new Date("2025-02-15T10:00:00Z");
    const result = getReportPeriodRange("quarter", ref);
    assertEquals(result.from, "2025-01-01");
    assertEquals(result.to, "2025-03-31");
    assertEquals(result.label, "Q1 2025");
  });

  await t.step("Q2 spans Apr 1 to Jun 30", () => {
    const ref = new Date("2025-05-15T10:00:00Z");
    const result = getReportPeriodRange("quarter", ref);
    assertEquals(result.from, "2025-04-01");
    assertEquals(result.to, "2025-06-30");
    assertEquals(result.label, "Q2 2025");
  });

  await t.step("Q3 spans Jul 1 to Sep 30", () => {
    const ref = new Date("2025-08-15T10:00:00Z");
    const result = getReportPeriodRange("quarter", ref);
    assertEquals(result.from, "2025-07-01");
    assertEquals(result.to, "2025-09-30");
    assertEquals(result.label, "Q3 2025");
  });

  await t.step("Q4 spans Oct 1 to Dec 31", () => {
    const ref = new Date("2025-11-15T10:00:00Z");
    const result = getReportPeriodRange("quarter", ref);
    assertEquals(result.from, "2025-10-01");
    assertEquals(result.to, "2025-12-31");
    assertEquals(result.label, "Q4 2025");
  });
});

// ============================================================================
// formatPeriodLabel tests
// ============================================================================

Deno.test("formatPeriodLabel - various ranges", async (t) => {
  await t.step("single day", () => {
    const result = formatPeriodLabel("2025-01-15", "2025-01-15");
    assertEquals(result, "Jan 15, 2025");
  });

  await t.step("same month range", () => {
    const result = formatPeriodLabel("2025-01-15", "2025-01-20");
    assertEquals(result, "Jan 15-20, 2025");
  });

  await t.step("different months same year", () => {
    const result = formatPeriodLabel("2025-01-15", "2025-02-20");
    assertEquals(result, "Jan 15 - Feb 20, 2025");
  });

  await t.step("different years", () => {
    const result = formatPeriodLabel("2024-12-15", "2025-01-20");
    assertEquals(result, "Dec 15, 2024 - Jan 20, 2025");
  });
});
