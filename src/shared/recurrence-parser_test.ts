import { assertEquals, assertNotEquals } from "@std/assert";
import { formatRecurrence, parseRecurrence } from "./recurrence-parser.ts";

// ============================================================================
// parseRecurrence tests
// ============================================================================

Deno.test("parseRecurrence - daily patterns", async (t) => {
  await t.step("parses 'daily'", () => {
    const result = parseRecurrence("daily");
    assertEquals(result, { type: "daily", interval: 1 });
  });

  await t.step("parses 'every day'", () => {
    const result = parseRecurrence("every day");
    assertEquals(result, { type: "daily", interval: 1 });
  });

  await t.step("parses 'every 3 days'", () => {
    const result = parseRecurrence("every 3 days");
    assertEquals(result, { type: "daily", interval: 3 });
  });

  await t.step("handles case insensitivity", () => {
    const result = parseRecurrence("DAILY");
    assertEquals(result, { type: "daily", interval: 1 });
  });
});

Deno.test("parseRecurrence - weekly patterns", async (t) => {
  await t.step("parses 'weekly'", () => {
    const result = parseRecurrence("weekly");
    assertEquals(result, { type: "weekly", interval: 1 });
  });

  await t.step("parses 'every week'", () => {
    const result = parseRecurrence("every week");
    assertEquals(result, { type: "weekly", interval: 1 });
  });

  await t.step("parses 'biweekly'", () => {
    const result = parseRecurrence("biweekly");
    assertEquals(result, { type: "weekly", interval: 2 });
  });

  await t.step("parses 'every other week'", () => {
    const result = parseRecurrence("every other week");
    assertEquals(result, { type: "weekly", interval: 2 });
  });

  await t.step("parses 'every 2 weeks'", () => {
    const result = parseRecurrence("every 2 weeks");
    assertEquals(result, { type: "weekly", interval: 2 });
  });

  await t.step("parses 'every Monday'", () => {
    const result = parseRecurrence("every Monday");
    assertEquals(result, { type: "weekly", interval: 1, daysOfWeek: [1] });
  });

  await t.step("parses 'every Mon'", () => {
    const result = parseRecurrence("every Mon");
    assertEquals(result, { type: "weekly", interval: 1, daysOfWeek: [1] });
  });

  await t.step("parses 'every Monday and Friday'", () => {
    const result = parseRecurrence("every Monday and Friday");
    assertEquals(result, { type: "weekly", interval: 1, daysOfWeek: [1, 5] });
  });

  await t.step("parses 'every Mon, Wed, Fri'", () => {
    const result = parseRecurrence("every Mon, Wed, Fri");
    assertEquals(result, {
      type: "weekly",
      interval: 1,
      daysOfWeek: [1, 3, 5],
    });
  });

  await t.step("parses 'every Sunday'", () => {
    const result = parseRecurrence("every Sunday");
    assertEquals(result, { type: "weekly", interval: 1, daysOfWeek: [0] });
  });
});

Deno.test("parseRecurrence - monthly patterns", async (t) => {
  await t.step("parses 'monthly'", () => {
    const result = parseRecurrence("monthly");
    assertEquals(result, { type: "monthly", interval: 1 });
  });

  await t.step("parses 'every month'", () => {
    const result = parseRecurrence("every month");
    assertEquals(result, { type: "monthly", interval: 1 });
  });

  await t.step("parses 'every 2 months'", () => {
    const result = parseRecurrence("every 2 months");
    assertEquals(result, { type: "monthly", interval: 2 });
  });

  await t.step("parses '1st of month'", () => {
    const result = parseRecurrence("1st of month");
    assertEquals(result, { type: "monthly", interval: 1, dayOfMonth: 1 });
  });

  await t.step("parses '15th of month'", () => {
    const result = parseRecurrence("15th of month");
    assertEquals(result, { type: "monthly", interval: 1, dayOfMonth: 15 });
  });

  await t.step("parses 'first of month'", () => {
    const result = parseRecurrence("first of month");
    assertEquals(result, { type: "monthly", interval: 1, dayOfMonth: 1 });
  });

  await t.step("parses 'last of month'", () => {
    const result = parseRecurrence("last of month");
    assertEquals(result, { type: "monthly", interval: 1, dayOfMonth: "last" });
  });

  await t.step("parses 'last day of month'", () => {
    const result = parseRecurrence("last day of month");
    assertEquals(result, { type: "monthly", interval: 1, dayOfMonth: "last" });
  });

  await t.step("parses 'first Monday of month'", () => {
    const result = parseRecurrence("first Monday of month");
    assertEquals(result, {
      type: "monthly",
      interval: 1,
      weekOfMonth: 1,
      weekday: 1,
    });
  });

  await t.step("parses 'second Tuesday of month'", () => {
    const result = parseRecurrence("second Tuesday of month");
    assertEquals(result, {
      type: "monthly",
      interval: 1,
      weekOfMonth: 2,
      weekday: 2,
    });
  });

  await t.step("parses 'last Friday of month'", () => {
    const result = parseRecurrence("last Friday of month");
    assertEquals(result, {
      type: "monthly",
      interval: 1,
      weekOfMonth: 5,
      weekday: 5,
    });
  });

  await t.step("parses '1st Mon of month'", () => {
    const result = parseRecurrence("1st Mon of month");
    assertEquals(result, {
      type: "monthly",
      interval: 1,
      weekOfMonth: 1,
      weekday: 1,
    });
  });
});

Deno.test("parseRecurrence - yearly patterns", async (t) => {
  await t.step("parses 'yearly'", () => {
    const result = parseRecurrence("yearly");
    assertEquals(result, { type: "yearly", interval: 1 });
  });

  await t.step("parses 'every year'", () => {
    const result = parseRecurrence("every year");
    assertEquals(result, { type: "yearly", interval: 1 });
  });

  await t.step("parses 'annually'", () => {
    const result = parseRecurrence("annually");
    assertEquals(result, { type: "yearly", interval: 1 });
  });

  await t.step("parses 'every 2 years'", () => {
    const result = parseRecurrence("every 2 years");
    assertEquals(result, { type: "yearly", interval: 2 });
  });
});

Deno.test("parseRecurrence - invalid patterns", async (t) => {
  await t.step("returns null for empty string", () => {
    assertEquals(parseRecurrence(""), null);
  });

  await t.step("returns null for invalid input", () => {
    assertEquals(parseRecurrence("not a recurrence"), null);
  });

  await t.step("returns null for out of range interval", () => {
    assertEquals(parseRecurrence("every 500 days"), null);
  });
});

// ============================================================================
// formatRecurrence tests
// ============================================================================

Deno.test("formatRecurrence - daily patterns", async (t) => {
  await t.step("formats daily interval 1", () => {
    const result = formatRecurrence({ type: "daily", interval: 1 });
    assertEquals(result, "every day");
  });

  await t.step("formats daily interval 3", () => {
    const result = formatRecurrence({ type: "daily", interval: 3 });
    assertEquals(result, "every 3 days");
  });
});

Deno.test("formatRecurrence - weekly patterns", async (t) => {
  await t.step("formats weekly interval 1", () => {
    const result = formatRecurrence({ type: "weekly", interval: 1 });
    assertEquals(result, "every week");
  });

  await t.step("formats weekly interval 2", () => {
    const result = formatRecurrence({ type: "weekly", interval: 2 });
    assertEquals(result, "every 2 weeks");
  });

  await t.step("formats single day of week", () => {
    const result = formatRecurrence({
      type: "weekly",
      interval: 1,
      daysOfWeek: [1],
    });
    assertEquals(result, "every Monday");
  });

  await t.step("formats two days of week", () => {
    const result = formatRecurrence({
      type: "weekly",
      interval: 1,
      daysOfWeek: [1, 5],
    });
    assertEquals(result, "every Monday and Friday");
  });

  await t.step("formats multiple days of week", () => {
    const result = formatRecurrence({
      type: "weekly",
      interval: 1,
      daysOfWeek: [1, 3, 5],
    });
    assertEquals(result, "every Monday, Wednesday, and Friday");
  });
});

Deno.test("formatRecurrence - monthly patterns", async (t) => {
  await t.step("formats monthly interval 1", () => {
    const result = formatRecurrence({ type: "monthly", interval: 1 });
    assertEquals(result, "every month");
  });

  await t.step("formats monthly interval 2", () => {
    const result = formatRecurrence({ type: "monthly", interval: 2 });
    assertEquals(result, "every 2 months");
  });

  await t.step("formats day of month", () => {
    const result = formatRecurrence({
      type: "monthly",
      interval: 1,
      dayOfMonth: 15,
    });
    assertEquals(result, "15th of month");
  });

  await t.step("formats 1st of month", () => {
    const result = formatRecurrence({
      type: "monthly",
      interval: 1,
      dayOfMonth: 1,
    });
    assertEquals(result, "1st of month");
  });

  await t.step("formats 2nd of month", () => {
    const result = formatRecurrence({
      type: "monthly",
      interval: 1,
      dayOfMonth: 2,
    });
    assertEquals(result, "2nd of month");
  });

  await t.step("formats 3rd of month", () => {
    const result = formatRecurrence({
      type: "monthly",
      interval: 1,
      dayOfMonth: 3,
    });
    assertEquals(result, "3rd of month");
  });

  await t.step("formats last day of month", () => {
    const result = formatRecurrence({
      type: "monthly",
      interval: 1,
      dayOfMonth: "last",
    });
    assertEquals(result, "last day of month");
  });

  await t.step("formats first weekday of month", () => {
    const result = formatRecurrence({
      type: "monthly",
      interval: 1,
      weekOfMonth: 1,
      weekday: 1,
    });
    assertEquals(result, "first Monday of month");
  });

  await t.step("formats last weekday of month", () => {
    const result = formatRecurrence({
      type: "monthly",
      interval: 1,
      weekOfMonth: 5,
      weekday: 5,
    });
    assertEquals(result, "last Friday of month");
  });
});

Deno.test("formatRecurrence - yearly patterns", async (t) => {
  await t.step("formats yearly interval 1", () => {
    const result = formatRecurrence({ type: "yearly", interval: 1 });
    assertEquals(result, "every year");
  });

  await t.step("formats yearly interval 2", () => {
    const result = formatRecurrence({ type: "yearly", interval: 2 });
    assertEquals(result, "every 2 years");
  });
});

// ============================================================================
// Round-trip tests (parse -> format -> parse)
// ============================================================================

Deno.test("parseRecurrence/formatRecurrence - round trips", async (t) => {
  const testCases = [
    "every day",
    "every 3 days",
    "every week",
    "every 2 weeks",
    "every Monday",
    "every Monday and Friday",
    "every month",
    "every 2 months",
    "every year",
  ];

  for (const input of testCases) {
    await t.step(`round-trips "${input}"`, () => {
      const parsed = parseRecurrence(input);
      assertNotEquals(parsed, null, `Failed to parse "${input}"`);
      if (parsed === null) {
        throw new Error(`Failed to parse "${input}"`);
      }
      const formatted = formatRecurrence(parsed);
      const reparsed = parseRecurrence(formatted);
      assertEquals(
        reparsed,
        parsed,
        `Round-trip failed: "${input}" -> "${formatted}"`,
      );
    });
  }
});
