/**
 * Recurrence Parser
 *
 * Parses natural language recurrence expressions like "every day", "every Monday",
 * "first of month" into RecurrenceRule objects.
 */

import type { RecurrenceRule } from "./schemas.ts";

// Day name mappings
const DAY_NAMES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

// Ordinal mappings for "first", "second", etc.
const ORDINALS: Record<string, number> = {
  first: 1,
  "1st": 1,
  second: 2,
  "2nd": 2,
  third: 3,
  "3rd": 3,
  fourth: 4,
  "4th": 4,
  fifth: 5,
  "5th": 5,
  last: -1, // Special case: handled separately
};

// Day names for formatting
const DAY_FORMAT: string[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Ordinal names for formatting
const ORDINAL_FORMAT: string[] = [
  "",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
];

/**
 * Parse a natural language recurrence string into a RecurrenceRule.
 *
 * Supported patterns:
 * - "daily" / "every day"
 * - "weekly" / "every week"
 * - "every Monday" / "every Mon"
 * - "every Monday and Friday" / "every Mon, Wed, Fri"
 * - "every 2 weeks" / "biweekly"
 * - "monthly" / "every month"
 * - "first of month" / "1st of month" / "15th of month"
 * - "last of month" / "last day of month"
 * - "first Monday of month"
 * - "yearly" / "every year" / "annually"
 *
 * @param input - Natural language recurrence string
 * @returns RecurrenceRule object or null if parsing fails
 */
export function parseRecurrence(input: string): RecurrenceRule | null {
  const normalized = input.toLowerCase().trim();

  // Daily patterns
  if (normalized === "daily" || normalized === "every day") {
    return { type: "daily", interval: 1 };
  }

  // Every N days
  const everyNDays = normalized.match(/^every\s+(\d+)\s+days?$/);
  if (everyNDays) {
    const interval = parseInt(everyNDays[1], 10);
    if (interval >= 1 && interval <= 365) {
      return { type: "daily", interval };
    }
    return null;
  }

  // Weekly patterns
  if (normalized === "weekly" || normalized === "every week") {
    return { type: "weekly", interval: 1 };
  }

  if (normalized === "biweekly" || normalized === "every other week") {
    return { type: "weekly", interval: 2 };
  }

  // Every N weeks
  const everyNWeeks = normalized.match(/^every\s+(\d+)\s+weeks?$/);
  if (everyNWeeks) {
    const interval = parseInt(everyNWeeks[1], 10);
    if (interval >= 1 && interval <= 52) {
      return { type: "weekly", interval };
    }
    return null;
  }

  // Every [day(s)] pattern - "every Monday" or "every Monday and Friday"
  const everyDayPattern = normalized.match(
    /^every\s+(.+?)(?:\s+(?:and|,)\s+(.+?))*$/,
  );
  if (everyDayPattern) {
    // Extract all day names from the input
    const daysPart = normalized.replace(/^every\s+/, "");
    const dayNames = daysPart.split(/\s*(?:and|,)\s*/).map((d) => d.trim());

    const daysOfWeek: number[] = [];
    for (const dayName of dayNames) {
      const dayNum = DAY_NAMES[dayName];
      if (dayNum !== undefined && !daysOfWeek.includes(dayNum)) {
        daysOfWeek.push(dayNum);
      }
    }

    if (daysOfWeek.length > 0) {
      daysOfWeek.sort((a, b) => a - b);
      return { type: "weekly", interval: 1, daysOfWeek };
    }
  }

  // Monthly patterns
  if (normalized === "monthly" || normalized === "every month") {
    return { type: "monthly", interval: 1 };
  }

  // Every N months
  const everyNMonths = normalized.match(/^every\s+(\d+)\s+months?$/);
  if (everyNMonths) {
    const interval = parseInt(everyNMonths[1], 10);
    if (interval >= 1 && interval <= 12) {
      return { type: "monthly", interval };
    }
    return null;
  }

  // Day of month patterns: "1st of month", "15th of month", "first of month"
  const dayOfMonthPattern = normalized.match(
    /^(\d+)(?:st|nd|rd|th)?\s+(?:of\s+)?(?:the\s+)?month$/,
  );
  if (dayOfMonthPattern) {
    const day = parseInt(dayOfMonthPattern[1], 10);
    if (day >= 1 && day <= 31) {
      return { type: "monthly", interval: 1, dayOfMonth: day };
    }
    return null;
  }

  // "first of month", "last of month"
  const ordinalOfMonth = normalized.match(
    /^(first|last|1st)\s+(?:day\s+)?(?:of\s+)?(?:the\s+)?month$/,
  );
  if (ordinalOfMonth) {
    const ordinal = ordinalOfMonth[1];
    if (ordinal === "last") {
      return { type: "monthly", interval: 1, dayOfMonth: "last" };
    }
    return { type: "monthly", interval: 1, dayOfMonth: 1 };
  }

  // Weekday of month patterns: "first Monday of month", "second Tuesday of month"
  const weekdayOfMonthPattern = normalized.match(
    /^(first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th)\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thurs|friday|fri|saturday|sat)\s+(?:of\s+)?(?:the\s+)?(?:each\s+)?month$/,
  );
  if (weekdayOfMonthPattern) {
    const ordinalStr = weekdayOfMonthPattern[1];
    const dayStr = weekdayOfMonthPattern[2];

    const weekday = DAY_NAMES[dayStr];
    if (weekday === undefined) return null;

    if (ordinalStr === "last") {
      // "last Monday of month" - use weekOfMonth: 5 as special marker
      return { type: "monthly", interval: 1, weekOfMonth: 5, weekday };
    }

    const weekOfMonth = ORDINALS[ordinalStr];
    if (weekOfMonth !== undefined && weekOfMonth >= 1 && weekOfMonth <= 5) {
      return { type: "monthly", interval: 1, weekOfMonth, weekday };
    }
    return null;
  }

  // Yearly patterns
  if (
    normalized === "yearly" ||
    normalized === "every year" ||
    normalized === "annually"
  ) {
    return { type: "yearly", interval: 1 };
  }

  // Every N years
  const everyNYears = normalized.match(/^every\s+(\d+)\s+years?$/);
  if (everyNYears) {
    const interval = parseInt(everyNYears[1], 10);
    if (interval >= 1 && interval <= 10) {
      return { type: "yearly", interval };
    }
    return null;
  }

  return null;
}

/**
 * Format a RecurrenceRule into a human-readable string.
 *
 * @param rule - The recurrence rule to format
 * @returns Human-readable recurrence description
 */
export function formatRecurrence(rule: RecurrenceRule): string {
  switch (rule.type) {
    case "daily":
      if (rule.interval === 1) return "every day";
      return `every ${rule.interval} days`;

    case "weekly":
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        const dayNames = rule.daysOfWeek.map((d) => DAY_FORMAT[d]);
        if (dayNames.length === 1) {
          return `every ${dayNames[0]}`;
        }
        if (dayNames.length === 2) {
          return `every ${dayNames[0]} and ${dayNames[1]}`;
        }
        const last = dayNames.pop();
        return `every ${dayNames.join(", ")}, and ${last}`;
      }
      if (rule.interval === 1) return "every week";
      if (rule.interval === 2) return "every 2 weeks";
      return `every ${rule.interval} weeks`;

    case "monthly":
      if (rule.weekOfMonth !== undefined && rule.weekday !== undefined) {
        const ordinal = rule.weekOfMonth === 5
          ? "last"
          : ORDINAL_FORMAT[rule.weekOfMonth];
        const dayName = DAY_FORMAT[rule.weekday];
        return `${ordinal} ${dayName} of month`;
      }
      if (rule.dayOfMonth !== undefined) {
        if (rule.dayOfMonth === "last") {
          return "last day of month";
        }
        const suffix = getOrdinalSuffix(rule.dayOfMonth);
        if (rule.interval === 1) {
          return `${rule.dayOfMonth}${suffix} of month`;
        }
        return `${rule.dayOfMonth}${suffix} of every ${rule.interval} months`;
      }
      if (rule.interval === 1) return "every month";
      return `every ${rule.interval} months`;

    case "yearly":
      if (rule.interval === 1) return "every year";
      return `every ${rule.interval} years`;
  }
}

/**
 * Get the ordinal suffix for a number (st, nd, rd, th).
 */
function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/** Result of parsing recurrence with error information */
export interface ParsedRecurrence {
  rule: RecurrenceRule | null;
  error?: string;
}

/**
 * Parse recurrence with detailed error message on failure.
 *
 * This is a convenience wrapper around parseRecurrence() that provides
 * a user-friendly error message when parsing fails.
 *
 * @param input - Natural language recurrence string
 * @returns ParsedRecurrence with rule (or null) and optional error message
 *
 * @example
 * const result = parseRecurrenceWithError("every Monday");
 * if (result.rule) {
 *   // Use result.rule
 * } else {
 *   console.error(result.error);
 * }
 */
export function parseRecurrenceWithError(input: string): ParsedRecurrence {
  const rule = parseRecurrence(input);
  if (!rule) {
    return {
      rule: null,
      error:
        `Invalid recurrence: "${input}". Try "every day", "every Monday", "monthly", etc.`,
    };
  }
  return { rule };
}
