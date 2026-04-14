/**
 * Recurrence Calculator
 *
 * Calculates the next due date for recurring tasks based on their recurrence rules.
 * Uses the rrule library for robust RFC 5545 compliant recurrence handling.
 *
 * Uses FIXED schedule approach: next due = original due + interval.
 * Preserves time component from the original due date.
 */

import rruleLib from "rrule";
const { RRule } = rruleLib;
import type { RecurrenceRule } from "./schemas.ts";

/**
 * Map JavaScript weekday (0=Sunday, 6=Saturday) to rrule weekday.
 * rrule uses: MO=0, TU=1, WE=2, TH=3, FR=4, SA=5, SU=6
 */
// deno-lint-ignore no-explicit-any
const JS_TO_RRULE_WEEKDAY: any[] = [
  RRule.SU, // JS 0 = Sunday
  RRule.MO, // JS 1 = Monday
  RRule.TU, // JS 2 = Tuesday
  RRule.WE, // JS 3 = Wednesday
  RRule.TH, // JS 4 = Thursday
  RRule.FR, // JS 5 = Friday
  RRule.SA, // JS 6 = Saturday
];

/**
 * Format a Date as ISO datetime string in UTC using Temporal.
 */
function formatDateTime(date: Date): string {
  const instant = Temporal.Instant.fromEpochMilliseconds(date.getTime());
  const utc = instant.toZonedDateTimeISO("UTC");
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${utc.year}-${pad(utc.month)}-${pad(utc.day)}T${pad(utc.hour)}:${
    pad(utc.minute)
  }:${pad(utc.second)}Z`;
}

/**
 * Parse an ISO date/datetime string into a Date object.
 * Handles both YYYY-MM-DD and YYYY-MM-DDTHH:MM:SSZ formats.
 */
function parseDate(dateStr: string): Date {
  // If already has time component, parse directly
  if (dateStr.includes("T")) {
    return new Date(dateStr);
  }
  // Date-only: default to midnight UTC
  return new Date(dateStr + "T00:00:00Z");
}

/**
 * Calculate the next due date based on a recurrence rule.
 *
 * Uses FIXED schedule: the next due date is calculated by adding the interval
 * to the current due date, not the completion date. This ensures consistent
 * schedules even if tasks are completed late.
 *
 * Preserves the time component from the original due date.
 *
 * @param currentDueDate - The current due date (ISO datetime) or null
 * @param rule - The recurrence rule
 * @param referenceDate - Optional reference date for when currentDueDate is null
 * @returns The next due date (ISO datetime) or null if calculation fails
 */
export function calculateNextDueDate(
  currentDueDate: string | null,
  rule: RecurrenceRule,
  referenceDate?: Date,
): string | null {
  // If no current due date, use today as the base
  const baseDate = currentDueDate
    ? parseDate(currentDueDate)
    : (referenceDate ?? new Date(Temporal.Now.instant().epochMilliseconds));

  try {
    switch (rule.type) {
      case "daily":
        return calculateDaily(baseDate, rule.interval);

      case "weekly":
        if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
          return calculateWeeklyWithDays(
            baseDate,
            rule.daysOfWeek,
            rule.interval,
          );
        }
        return calculateWeekly(baseDate, rule.interval);

      case "monthly":
        if (rule.weekOfMonth !== undefined && rule.weekday !== undefined) {
          return calculateMonthlyNthWeekday(
            baseDate,
            rule.weekOfMonth,
            rule.weekday,
            rule.interval,
          );
        }
        if (rule.dayOfMonth !== undefined) {
          return calculateMonthlyDay(baseDate, rule.dayOfMonth, rule.interval);
        }
        return calculateMonthly(baseDate, rule.interval);

      case "yearly":
        return calculateYearly(baseDate, rule.interval);
    }
  } catch {
    return null;
  }
}

/**
 * Daily recurrence: add N days.
 */
function calculateDaily(baseDate: Date, interval: number): string {
  const rrule = new RRule({
    freq: RRule.DAILY,
    interval,
    dtstart: baseDate,
    count: 2,
  });
  const dates = rrule.all();
  const next = dates[1]; // Skip the dtstart, get next occurrence
  return formatWithBaseTime(next, baseDate);
}

/**
 * Simple weekly recurrence: add N weeks.
 */
function calculateWeekly(baseDate: Date, interval: number): string {
  const rrule = new RRule({
    freq: RRule.WEEKLY,
    interval,
    dtstart: baseDate,
    count: 2,
  });
  const dates = rrule.all();
  const next = dates[1];
  return formatWithBaseTime(next, baseDate);
}

/**
 * Weekly recurrence with specific days of week.
 * Finds the next occurrence of one of the specified weekdays.
 */
function calculateWeeklyWithDays(
  baseDate: Date,
  daysOfWeek: number[],
  interval: number,
): string {
  // deno-lint-ignore no-explicit-any
  const byweekday = daysOfWeek.map((d) => JS_TO_RRULE_WEEKDAY[d]) as any;

  const rrule = new RRule({
    freq: RRule.WEEKLY,
    interval,
    dtstart: baseDate,
    byweekday,
  });

  // Get next occurrence after baseDate (exclusive)
  const next = rrule.after(baseDate, false);
  if (!next) return formatWithBaseTime(baseDate, baseDate);
  return formatWithBaseTime(next, baseDate);
}

/**
 * Simple monthly recurrence: add N months (same day).
 * Uses Temporal which clamps overflow (e.g., Jan 31 + 1 month = Feb 28).
 */
function calculateMonthly(baseDate: Date, interval: number): string {
  const instant = Temporal.Instant.fromEpochMilliseconds(baseDate.getTime());
  const utc = instant.toZonedDateTimeISO("UTC");
  const next = utc.add({ months: interval });
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.year}-${pad(next.month)}-${pad(next.day)}T${pad(next.hour)}:${
    pad(next.minute)
  }:${pad(next.second)}Z`;
}

/**
 * Monthly recurrence on a specific day of month.
 * Uses FIXED schedule: advance by interval months first, then find the day.
 */
function calculateMonthlyDay(
  baseDate: Date,
  dayOfMonth: number | "last",
  interval: number,
): string {
  const instant = Temporal.Instant.fromEpochMilliseconds(baseDate.getTime());
  const base = instant.toZonedDateTimeISO("UTC");

  // Advance to the target month (add months, clamp to day 1 to avoid overflow)
  const targetMonth = base.with({ day: 1 }).add({ months: interval });

  let day: number;
  if (dayOfMonth === "last") {
    day = targetMonth.daysInMonth;
  } else {
    // Specific day, clamped to last day of month
    day = Math.min(dayOfMonth, targetMonth.daysInMonth);
  }

  const result = targetMonth.with({
    day,
    hour: base.hour,
    minute: base.minute,
    second: base.second,
  });
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${result.year}-${pad(result.month)}-${pad(result.day)}T${
    pad(result.hour)
  }:${pad(result.minute)}:${pad(result.second)}Z`;
}

/**
 * Monthly recurrence on the Nth weekday (e.g., "second Monday of month").
 */
function calculateMonthlyNthWeekday(
  baseDate: Date,
  weekOfMonth: number,
  weekday: number,
  interval: number,
): string | null {
  const instant = Temporal.Instant.fromEpochMilliseconds(baseDate.getTime());
  const base = instant.toZonedDateTimeISO("UTC");

  // Advance to target month
  const targetMonth = base.with({ day: 1 }).add({ months: interval });
  let year = targetMonth.year;
  // Temporal months are 1-indexed, rrule Date constructor needs 0-indexed
  let month = targetMonth.month - 1;

  // Use rrule to find the Nth weekday in this month
  const rruleWeekday = JS_TO_RRULE_WEEKDAY[weekday];
  const nth = weekOfMonth === 5 ? -1 : weekOfMonth;

  // Create a date at the start of the target month
  const monthStart = new Date(Date.UTC(year, month, 1));

  const rrule = new RRule({
    freq: RRule.MONTHLY,
    dtstart: monthStart,
    // deno-lint-ignore no-explicit-any
    byweekday: [rruleWeekday.nth(nth)] as any,
    count: 1,
  });

  const dates = rrule.all();
  if (dates.length === 0) {
    // If the date doesn't exist this month (e.g., 5th Monday), try next month
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
    const nextMonthStart = new Date(Date.UTC(year, month, 1));
    const rrule2 = new RRule({
      freq: RRule.MONTHLY,
      dtstart: nextMonthStart,
      // deno-lint-ignore no-explicit-any
      byweekday: [rruleWeekday.nth(nth)] as any,
      count: 1,
    });
    const dates2 = rrule2.all();
    if (dates2.length === 0) return null;
    return formatWithBaseTime(dates2[0], baseDate);
  }

  return formatWithBaseTime(dates[0], baseDate);
}

/**
 * Yearly recurrence: add N years.
 * Uses Temporal which clamps overflow (e.g., Feb 29 + 1 year = Feb 28).
 */
function calculateYearly(baseDate: Date, interval: number): string {
  const instant = Temporal.Instant.fromEpochMilliseconds(baseDate.getTime());
  const utc = instant.toZonedDateTimeISO("UTC");
  const next = utc.add({ years: interval });
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.year}-${pad(next.month)}-${pad(next.day)}T${pad(next.hour)}:${
    pad(next.minute)
  }:${pad(next.second)}Z`;
}

/**
 * Format a date preserving the time from baseDate.
 * Takes date portion from rrule result and time from original base.
 */
function formatWithBaseTime(date: Date, baseDate: Date): string {
  const baseInstant = Temporal.Instant.fromEpochMilliseconds(
    baseDate.getTime(),
  );
  const baseUtc = baseInstant.toZonedDateTimeISO("UTC");

  // rrule returns dates using local getters for the date portion
  const resultDate = Temporal.PlainDate.from({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });

  const combined = resultDate.toPlainDateTime({
    hour: baseUtc.hour,
    minute: baseUtc.minute,
    second: baseUtc.second,
  });

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${combined.year}-${pad(combined.month)}-${pad(combined.day)}T${
    pad(combined.hour)
  }:${pad(combined.minute)}:${pad(combined.second)}Z`;
}
