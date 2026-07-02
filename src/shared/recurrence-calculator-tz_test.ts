/**
 * Timezone regression tests for recurrence-calculator.ts.
 *
 * rrule works in "UTC as fake-local" time, so results must be read back with
 * UTC getters. Reading them with local getters shifted every rrule-based
 * calculation by one day in UTC-negative timezones. The in-process test suite
 * can't reproduce that (V8 caches the process timezone), so these tests run
 * the calculator in a subprocess pinned to TZ=America/New_York.
 */

import { assertEquals } from "@std/assert";

const CASES: Array<{
  name: string;
  due: string;
  // deno-lint-ignore no-explicit-any
  rule: any;
  expected: string;
}> = [
  {
    name: "daily advances one day",
    due: "2025-01-06T00:00:00Z",
    rule: { type: "daily", interval: 1 },
    expected: "2025-01-07T00:00:00Z",
  },
  {
    name: "every Monday lands on a Monday",
    due: "2025-01-06T00:00:00Z",
    rule: { type: "weekly", interval: 1, daysOfWeek: [1] },
    expected: "2025-01-13T00:00:00Z",
  },
  {
    name: "biweekly advances two weeks",
    due: "2025-01-06T00:00:00Z",
    rule: { type: "weekly", interval: 2 },
    expected: "2025-01-20T00:00:00Z",
  },
  {
    name: "last Monday of month lands on a Monday",
    due: "2025-01-27T00:00:00Z",
    rule: { type: "monthly", interval: 1, weekOfMonth: 5, weekday: 1 },
    expected: "2025-02-24T00:00:00Z",
  },
  {
    name: "preserves non-midnight time",
    due: "2025-01-06T23:30:00Z",
    rule: { type: "daily", interval: 1 },
    expected: "2025-01-07T23:30:00Z",
  },
];

Deno.test("calculateNextDueDate - correct in UTC-negative timezone", async () => {
  const moduleUrl = import.meta.resolve("./recurrence-calculator.ts");
  const script = `
    import { calculateNextDueDate } from ${JSON.stringify(moduleUrl)};
    const cases = ${JSON.stringify(CASES)};
    const results = cases.map((c) => calculateNextDueDate(c.due, c.rule));
    console.log(JSON.stringify(results));
  `;

  const command = new Deno.Command(Deno.execPath(), {
    args: ["eval", script],
    env: { TZ: "America/New_York" },
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await command.output();
  assertEquals(
    code,
    0,
    `subprocess failed: ${new TextDecoder().decode(stderr)}`,
  );

  const results = JSON.parse(new TextDecoder().decode(stdout).trim());
  for (let i = 0; i < CASES.length; i++) {
    assertEquals(results[i], CASES[i].expected, CASES[i].name);
  }
});
