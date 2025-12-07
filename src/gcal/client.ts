/**
 * Google Calendar API client.
 *
 * Provides methods for creating, updating, and listing calendar events.
 */

import { logger } from "../shared/logger.ts";
import { assert } from "../shared/assert.ts";
import {
  GcalAuthError,
  getValidAccessToken,
  refreshAccessToken,
} from "./auth.ts";
import { getGcalTokens, saveGcalTokens } from "./secrets.ts";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  htmlLink?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: "popup" | "email";
      minutes: number;
    }>;
  };
}

export interface CalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
}

export interface GcalClient {
  createEvent(calendarId: string, event: CalendarEvent): Promise<CalendarEvent>;
  updateEvent(
    calendarId: string,
    eventId: string,
    event: CalendarEvent,
  ): Promise<CalendarEvent>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
  getEvent(calendarId: string, eventId: string): Promise<CalendarEvent | null>;
  listCalendars(): Promise<CalendarListEntry[]>;
}

/**
 * Create a Google Calendar API client.
 */
export function createGcalClient(): GcalClient {
  return {
    createEvent: (calendarId, event) => createEvent(calendarId, event),
    updateEvent: (calendarId, eventId, event) =>
      updateEvent(calendarId, eventId, event),
    deleteEvent: (calendarId, eventId) => deleteEvent(calendarId, eventId),
    getEvent: (calendarId, eventId) => getEvent(calendarId, eventId),
    listCalendars: () => listCalendars(),
  };
}

/**
 * Make authenticated API request with automatic token refresh.
 */
async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const makeRequest = async (accessToken: string): Promise<Response> => {
    const url = `${CALENDAR_API_BASE}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    return response;
  };

  // Get access token (auto-refreshes if needed)
  let accessToken = await getValidAccessToken();
  let response = await makeRequest(accessToken);

  // If 401, try refreshing token once more
  if (response.status === 401) {
    logger.info("Got 401, refreshing token...", "gcal");
    const tokens = await getGcalTokens();
    if (!tokens) {
      throw new GcalAuthError("Not authenticated");
    }
    const newTokens = await refreshAccessToken(tokens.refresh_token);
    await saveGcalTokens(newTokens);
    accessToken = newTokens.access_token;
    response = await makeRequest(accessToken);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Calendar API error (${response.status}): ${error}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

/**
 * Create a new calendar event.
 */
async function createEvent(
  calendarId: string,
  event: CalendarEvent,
): Promise<CalendarEvent> {
  assert(event.summary.length > 0, "Event summary must not be empty", "gcal");
  assert(event.start.dateTime, "Event start dateTime is required", "gcal");
  assert(event.end.dateTime, "Event end dateTime is required", "gcal");

  logger.info(`Creating calendar event: ${event.summary}`, "gcal");

  const result = await apiRequest<CalendarEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      body: JSON.stringify(event),
    },
  );

  logger.info(`Created event with ID: ${result.id}`, "gcal");
  return result;
}

/**
 * Update an existing calendar event.
 */
async function updateEvent(
  calendarId: string,
  eventId: string,
  event: CalendarEvent,
): Promise<CalendarEvent> {
  assert(eventId.length > 0, "Event ID must not be empty", "gcal");
  assert(event.summary.length > 0, "Event summary must not be empty", "gcal");

  logger.info(`Updating calendar event: ${eventId}`, "gcal");

  const result = await apiRequest<CalendarEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${
      encodeURIComponent(eventId)
    }`,
    {
      method: "PUT",
      body: JSON.stringify(event),
    },
  );

  logger.info(`Updated event: ${result.id}`, "gcal");
  return result;
}

/**
 * Delete a calendar event.
 */
async function deleteEvent(
  calendarId: string,
  eventId: string,
): Promise<void> {
  assert(eventId.length > 0, "Event ID must not be empty", "gcal");

  logger.info(`Deleting calendar event: ${eventId}`, "gcal");

  await apiRequest<void>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${
      encodeURIComponent(eventId)
    }`,
    {
      method: "DELETE",
    },
  );

  logger.info(`Deleted event: ${eventId}`, "gcal");
}

/**
 * Get a calendar event by ID.
 * Returns null if not found.
 */
async function getEvent(
  calendarId: string,
  eventId: string,
): Promise<CalendarEvent | null> {
  assert(eventId.length > 0, "Event ID must not be empty", "gcal");

  try {
    const result = await apiRequest<CalendarEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events/${
        encodeURIComponent(eventId)
      }`,
    );
    return result;
  } catch (error) {
    // Return null for 404
    if (String(error).includes("404")) {
      return null;
    }
    throw error;
  }
}

/**
 * List all calendars accessible to the user.
 */
async function listCalendars(): Promise<CalendarListEntry[]> {
  logger.info("Listing calendars", "gcal");

  const result = await apiRequest<{ items: CalendarListEntry[] }>(
    "/users/me/calendarList",
  );

  return result.items.map((item) => ({
    id: item.id,
    summary: item.summary,
    primary: item.primary,
  }));
}

/**
 * Calculate event end time from start time and duration.
 */
export function calculateEndTime(
  startIso: string,
  durationHours: number,
): string {
  const start = new Date(startIso);
  const durationMs = durationHours * 60 * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);
  return end.toISOString();
}

/**
 * Get the HTML link for a calendar event.
 */
export function getEventUrl(
  eventId: string,
  calendarId = "primary",
): string {
  // Google Calendar event URL format
  return `https://calendar.google.com/calendar/event?eid=${
    btoa(`${eventId} ${calendarId}`).replace(/=/g, "")
  }`;
}
