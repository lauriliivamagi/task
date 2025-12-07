/**
 * Natural Language Date Parser
 *
 * Parses human-friendly date expressions like "tomorrow", "next Monday",
 * "in 3 days" into ISO datetime strings (YYYY-MM-DDTHH:MM:SSZ).
 */

import * as chrono from "chrono-node";
import {
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  format,
  getQuarter,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
} from "date-fns";
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

    // Create local date from components and convert to UTC
    // Note: Date constructor uses 0-indexed months, chrono returns 1-indexed
    const localDate = new Date(year, month - 1, day, hour, minute, second);
    return localDate.toISOString();
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

  // Parse as local time (no Z suffix means JS treats it as local)
  const localDate = new Date(localDateStr);

  // Convert to UTC ISO string
  return localDate.toISOString();
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
    const date = new Date(utcString);
    if (isNaN(date.getTime())) return "";

    const pad = (n: number) => String(n).padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return "";
  }
}

/**
 * Format a date as ISO string (YYYY-MM-DD) using date-fns.
 */
function formatDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Get the Monday of the week containing the given date.
 */
function getMonday(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

/**
 * Get the Sunday of the week containing the given date.
 */
function getSunday(date: Date): Date {
  return endOfWeek(date, { weekStartsOn: 1 });
}

/**
 * Get the first day of the month containing the given date.
 */
function getFirstOfMonth(date: Date): Date {
  return startOfMonth(date);
}

/**
 * Get the last day of the month containing the given date.
 */
function getLastOfMonth(date: Date): Date {
  return endOfMonth(date);
}

/**
 * Get the first day of the quarter containing the given date.
 */
function getFirstOfQuarter(date: Date): Date {
  return startOfQuarter(date);
}

/**
 * Get the last day of the quarter containing the given date.
 */
function getLastOfQuarter(date: Date): Date {
  return endOfQuarter(date);
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
  reference?: Date,
): { from: string; to: string; label: string } {
  const ref = reference ?? new Date();

  switch (period) {
    case "week": {
      const monday = getMonday(ref);
      const sunday = getSunday(ref);
      const monStr = formatDate(monday);
      const sunStr = formatDate(sunday);

      // Format label: "Week of Dec 2-8, 2025"
      const monMonth = MONTH_NAMES[monday.getMonth()].slice(0, 3);
      const sunMonth = MONTH_NAMES[sunday.getMonth()].slice(0, 3);
      const year = sunday.getFullYear();

      let label: string;
      if (monday.getMonth() === sunday.getMonth()) {
        label =
          `Week of ${monMonth} ${monday.getDate()}-${sunday.getDate()}, ${year}`;
      } else {
        label =
          `Week of ${monMonth} ${monday.getDate()} - ${sunMonth} ${sunday.getDate()}, ${year}`;
      }

      return { from: monStr, to: sunStr, label };
    }

    case "month": {
      const first = getFirstOfMonth(ref);
      const last = getLastOfMonth(ref);
      const label = `${MONTH_NAMES[ref.getMonth()]} ${ref.getFullYear()}`;
      return { from: formatDate(first), to: formatDate(last), label };
    }

    case "quarter": {
      const quarter = getQuarter(ref);
      const first = getFirstOfQuarter(ref);
      const last = getLastOfQuarter(ref);
      const label = `Q${quarter} ${ref.getFullYear()}`;
      return { from: formatDate(first), to: formatDate(last), label };
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
  const fromDate = new Date(from + "T00:00:00");
  const toDate = new Date(to + "T00:00:00");

  const fromMonth = MONTH_NAMES[fromDate.getMonth()].slice(0, 3);
  const toMonth = MONTH_NAMES[toDate.getMonth()].slice(0, 3);

  if (from === to) {
    return `${fromMonth} ${fromDate.getDate()}, ${fromDate.getFullYear()}`;
  }

  if (
    fromDate.getFullYear() === toDate.getFullYear() &&
    fromDate.getMonth() === toDate.getMonth()
  ) {
    // Same month and year
    return `${fromMonth} ${fromDate.getDate()}-${toDate.getDate()}, ${fromDate.getFullYear()}`;
  }

  if (fromDate.getFullYear() === toDate.getFullYear()) {
    // Same year, different months
    return `${fromMonth} ${fromDate.getDate()} - ${toMonth} ${toDate.getDate()}, ${fromDate.getFullYear()}`;
  }

  // Different years
  return `${fromMonth} ${fromDate.getDate()}, ${fromDate.getFullYear()} - ${toMonth} ${toDate.getDate()}, ${toDate.getFullYear()}`;
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
