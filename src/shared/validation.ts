/**
 * Centralized validation utilities.
 *
 * Provides reusable validation functions for both CLI commands and server routes.
 * Uses Zod schemas for consistency with existing validation.
 */

import { z } from "zod";

// Duration validation (0.25-24 hours)
export const DurationHours = z.number().min(0.25).max(24);
export type DurationHours = z.infer<typeof DurationHours>;

/** Validation result type */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate task duration in hours.
 * Valid range: 0.25 to 24 hours.
 */
export function validateDuration(value: number): ValidationResult {
  const result = DurationHours.safeParse(value);
  if (!result.success) {
    return {
      valid: false,
      error: "Duration must be between 0.25 and 24 hours.",
    };
  }
  return { valid: true };
}

/**
 * Validate task priority.
 * Valid values: 0 (normal), 1 (high), 2 (urgent).
 */
export function validatePriority(value: number): ValidationResult {
  if (value < 0 || value > 2) {
    return {
      valid: false,
      error: "Priority must be 0 (normal), 1 (high), or 2 (urgent).",
    };
  }
  return { valid: true };
}

/**
 * Validate that subtasks cannot have recurrence.
 * Only top-level tasks can be recurring.
 */
export function validateRecurrenceForSubtask(
  hasParent: boolean,
  hasRecurrence: boolean,
): ValidationResult {
  if (hasParent && hasRecurrence) {
    return {
      valid: false,
      error:
        "Subtasks cannot have recurrence. Only top-level tasks can be recurring.",
    };
  }
  return { valid: true };
}
