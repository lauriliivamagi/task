/**
 * Natural Language Date Parser
 *
 * Parses human-friendly date expressions like "tomorrow", "next Monday",
 * "in 3 days" into ISO datetime strings (YYYY-MM-DDTHH:MM:SSZ).
 */

import * as chrono from "chrono-node";
import { assertNonEmptyString } from "./assert.ts";

/**
 * Parse a natural language date/datetime string into ISO format.
 *
 * @param input - Natural language date string (e.g., "tomorrow", "tomorrow at 14:00", "next Friday 14:30")
 * @param reference - Optional reference date (defaults to current date)
 * @returns ISO datetime string (YYYY-MM-DDTHH:MM:SSZ) or null if parsing fails
 *
 * When no time is specified, defaults to 00:00:00 (start of day).
 *
 * @example
 * parseNaturalDate("tomorrow") // "2024-12-20T00:00:00Z"
 * parseNaturalDate("tomorrow at 14:00") // "2024-12-20T14:00:00Z"
 * parseNaturalDate("next Monday 14:30") // "2024-12-23T14:30:00Z"
 * parseNaturalDate("December 25") // "2024-12-25T00:00:00Z"
 * parseNaturalDate("invalid") // null
 */
export function parseNaturalDate(
  input: string,
  reference?: Date,
): string | null {
  assertNonEmptyString(input, "Date input cannot be empty", "date-parser");
  try {
    const results = chrono.parse(input, reference ?? new Date());
    if (results.length === 0) {
      return null;
    }

    const result = results[0];
    const startComponents = result.start;

    // Extract date components
    const year = startComponents.get("year");
    const month = startComponents.get("month");
    const day = startComponents.get("day");

    if (year == null || month == null || day == null) {
      return null;
    }

    // Check if time was explicitly specified
    const hasTime = startComponents.isCertain("hour");

    let hour = 0;
    let minute = 0;
    let second = 0;

    if (hasTime) {
      hour = startComponents.get("hour") ?? 0;
      minute = startComponents.get("minute") ?? 0;
      second = startComponents.get("second") ?? 0;
    }

    // Create local datetime from components and convert to UTC
    // Temporal uses 1-indexed months (same as chrono), no footgun
    const pdt = new Temporal.PlainDateTime(
      year,
      month,
      day,
      hour,
      minute,
      second,
    );
    const zdt = pdt.toZonedDateTime(Temporal.Now.timeZoneId());
    return zdt.toInstant().toString();
  } catch {
    return null;
  }
}

/**
 * Resolve a due date from either an ISO datetime string or natural language.
 *
 * Priority:
 * 1. If `dueDate` (ISO) is provided, normalize it to full datetime
 * 2. If `dueDateNatural` is provided, parse it
 * 3. Return null if neither is provided or natural parsing fails
 *
 * @param dueDate - ISO date/datetime string (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)
 * @param dueDateNatural - Natural language date string
 * @returns ISO datetime string (YYYY-MM-DDTHH:MM:SSZ) or null
 */
export function resolveDueDate(
  dueDate?: string,
  dueDateNatural?: string,
): string | null {
  // Explicit ISO date/datetime takes precedence
  if (dueDate) {
    return normalizeDateToDateTime(dueDate);
  }

  // Try parsing natural language
  if (dueDateNatural) {
    return parseNaturalDate(dueDateNatural);
  }

  return null;
}

/**
 * Normalize a date or datetime string to full ISO datetime format (UTC).
 *
 * - Date-only (YYYY-MM-DD) → YYYY-MM-DDT00:00:00Z (midnight UTC, represents "the day")
 * - Datetime with T and Z (YYYY-MM-DDTHH:MM:SSZ) → already UTC, returned as-is
 * - Datetime with T no Z (YYYY-MM-DDTHH:MM:SS) → local time converted to UTC
 * - Datetime with space (YYYY-MM-DD HH:MM) → local time converted to UTC
 *
 * Date-only inputs are treated as UTC midnight (representing "the day").
 * Datetime inputs with explicit time are treated as local time and converted to UTC.
 *
 * @param input - Date or datetime string
 * @returns ISO datetime string in UTC (YYYY-MM-DDTHH:MM:SSZ)
 */
export function normalizeDateToDateTime(input: string): string {
  assertNonEmptyString(input, "Date input cannot be empty", "date-parser");
  // Already UTC (has Z suffix) - return as-is
  if (input.endsWith("Z")) {
    return input;
  }

  // Check for time component (T separator or space with HH:MM)
  const hasTimeComponent = input.includes("T") ||
    /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(input);

  if (!hasTimeComponent) {
    // Date-only format (YYYY-MM-DD) → midnight UTC (represents "the day")
    return `${input}T00:00:00Z`;
  }

  // Has time component - parse as local time and convert to UTC
  let localDateStr: string;

  if (input.includes("T")) {
    // Datetime with T separator (no Z) - treat as local time
    localDateStr = input;
  } else {
    // Space-separated datetime format (YYYY-MM-DD HH:MM or YYYY-MM-DD HH:MM:SS)
    const spaceMatch = input.match(
      /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)$/,
    );
    if (spaceMatch) {
      const [, datePart, timePart] = spaceMatch;
      const normalizedTime = timePart.length === 5
        ? timePart + ":00"
        : timePart;
      localDateStr = `${datePart}T${normalizedTime}`;
    } else {
      // Fallback - shouldn't reach here given the hasTimeComponent check
      localDateStr = `${input}T00:00:00`;
    }
  }

  // Parse as local time and convert to UTC
  const pdt = Temporal.PlainDateTime.from(localDateStr);
  const zdt = pdt.toZonedDateTime(Temporal.Now.timeZoneId());
  return zdt.toInstant().toString();
}

/**
 * Convert a UTC datetime string to local time format for editing.
 *
 * Returns format "YYYY-MM-DD HH:MM" in local time, suitable for user input.
 *
 * @param utcString - UTC datetime string (e.g., "2025-12-05T09:00:00.000Z")
 * @returns Local time string "YYYY-MM-DD HH:MM" or empty string if invalid
 */
export function formatDateTimeForEditing(utcString: string): string {
  if (!utcString) return "";

  try {
    const instant = Temporal.Instant.from(utcString);
    const local = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId());

    const pad = (n: number) => String(n).padStart(2, "0");
    return `${local.year}-${pad(local.month)}-${pad(local.day)} ${
      pad(local.hour)
    }:${pad(local.minute)}`;
  } catch {
    return "";
  }
}

/**
 * Get the Monday of the week containing the given date.
 * Temporal.PlainDate.dayOfWeek: 1=Monday, 7=Sunday
 */
function getMonday(date: Temporal.PlainDate): Temporal.PlainDate {
  return date.subtract({ days: date.dayOfWeek - 1 });
}

/**
 * Get the Sunday of the week containing the given date.
 */
function getSunday(date: Temporal.PlainDate): Temporal.PlainDate {
  return date.add({ days: 7 - date.dayOfWeek });
}

/**
 * Get the first day of the month containing the given date.
 */
function getFirstOfMonth(date: Temporal.PlainDate): Temporal.PlainDate {
  return date.with({ day: 1 });
}

/**
 * Get the last day of the month containing the given date.
 */
function getLastOfMonth(date: Temporal.PlainDate): Temporal.PlainDate {
  return date.with({ day: date.daysInMonth });
}

/**
 * Get the first day of the quarter containing the given date.
 */
function getFirstOfQuarter(date: Temporal.PlainDate): Temporal.PlainDate {
  const quarterStartMonth = Math.floor((date.month - 1) / 3) * 3 + 1;
  return date.with({ month: quarterStartMonth, day: 1 });
}

/**
 * Get the last day of the quarter containing the given date.
 */
function getLastOfQuarter(date: Temporal.PlainDate): Temporal.PlainDate {
  const quarterEndMonth = Math.floor((date.month - 1) / 3) * 3 + 3;
  const endMonth = date.with({ month: quarterEndMonth, day: 1 });
  return endMonth.with({ day: endMonth.daysInMonth });
}

/**
 * Get the quarter number (1-4) for a date.
 */
function getQuarter(date: Temporal.PlainDate): number {
  return Math.ceil(date.month / 3);
}

/**
 * Month names for display.
 */
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Get date range for a report period.
 *
 * - Week: Monday to Sunday of current week
 * - Month: 1st to last day of current month
 * - Quarter: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
 *
 * @param period - The period type (week, month, quarter)
 * @param reference - Reference date (defaults to current date)
 * @returns Object with from, to (ISO date strings), and label
 */
export function getReportPeriodRange(
  period: "week" | "month" | "quarter",
  reference?: Temporal.PlainDate,
): { from: string; to: string; label: string } {
  const ref = reference ?? Temporal.Now.plainDateISO();

  switch (period) {
    case "week": {
      const monday = getMonday(ref);
      const sunday = getSunday(ref);

      // Format label: "Week of Dec 2-8, 2025"
      const monMonth = MONTH_NAMES[monday.month - 1].slice(0, 3);
      const sunMonth = MONTH_NAMES[sunday.month - 1].slice(0, 3);
      const year = sunday.year;

      let label: string;
      if (monday.month === sunday.month) {
        label = `Week of ${monMonth} ${monday.day}-${sunday.day}, ${year}`;
      } else {
        label =
          `Week of ${monMonth} ${monday.day} - ${sunMonth} ${sunday.day}, ${year}`;
      }

      return { from: monday.toString(), to: sunday.toString(), label };
    }

    case "month": {
      const first = getFirstOfMonth(ref);
      const last = getLastOfMonth(ref);
      const label = `${MONTH_NAMES[ref.month - 1]} ${ref.year}`;
      return { from: first.toString(), to: last.toString(), label };
    }

    case "quarter": {
      const quarter = getQuarter(ref);
      const first = getFirstOfQuarter(ref);
      const last = getLastOfQuarter(ref);
      const label = `Q${quarter} ${ref.year}`;
      return { from: first.toString(), to: last.toString(), label };
    }
  }
}

/**
 * Format a period label for a custom date range.
 *
 * @param from - Start date (YYYY-MM-DD)
 * @param to - End date (YYYY-MM-DD)
 * @returns Human-readable label
 */
export function formatPeriodLabel(from: string, to: string): string {
  const fromDate = Temporal.PlainDate.from(from);
  const toDate = Temporal.PlainDate.from(to);

  const fromMonth = MONTH_NAMES[fromDate.month - 1].slice(0, 3);
  const toMonth = MONTH_NAMES[toDate.month - 1].slice(0, 3);

  if (from === to) {
    return `${fromMonth} ${fromDate.day}, ${fromDate.year}`;
  }

  if (fromDate.year === toDate.year && fromDate.month === toDate.month) {
    // Same month and year
    return `${fromMonth} ${fromDate.day}-${toDate.day}, ${fromDate.year}`;
  }

  if (fromDate.year === toDate.year) {
    // Same year, different months
    return `${fromMonth} ${fromDate.day} - ${toMonth} ${toDate.day}, ${fromDate.year}`;
  }

  // Different years
  return `${fromMonth} ${fromDate.day}, ${fromDate.year} - ${toMonth} ${toDate.day}, ${toDate.year}`;
}

/**
 * Parse due date from either ISO format or natural language.
 *
 * Automatically detects format:
 * - Strings starting with YYYY-MM-DD are treated as ISO format
 * - All other strings are parsed as natural language
 *
 * @param input - Date string (ISO or natural language)
 * @returns ISO datetime string (YYYY-MM-DDTHH:MM:SSZ) or null if parsing fails
 *
 * @example
 * parseDueDate("2024-12-31") // "2024-12-31T00:00:00Z"
 * parseDueDate("2024-12-31T14:00:00Z") // "2024-12-31T14:00:00Z"
 * parseDueDate("tomorrow at 14:00") // parses as natural language
 * parseDueDate("invalid") // null
 */
export function parseDueDate(input: string): string | null {
  const isIsoFormat = /^\d{4}-\d{2}-\d{2}/.test(input);
  return isIsoFormat
    ? resolveDueDate(input, undefined)
    : resolveDueDate(undefined, input);
}
