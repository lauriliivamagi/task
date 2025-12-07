/**
 * Google Calendar OAuth token storage.
 *
 * Stores tokens in ~/.task-cli/secrets.json
 */

import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import { logger } from "../shared/logger.ts";

const CONFIG_DIR = join(Deno.env.get("HOME") || ".", ".task-cli");
const SECRETS_FILE = join(CONFIG_DIR, "secrets.json");

export interface GcalTokens {
  access_token: string;
  refresh_token: string;
  expiry: string; // ISO datetime
  token_type: string;
}

export interface GcalCredentials {
  client_id: string;
  client_secret: string;
}

interface SecretsFile {
  gcal?: GcalTokens;
  gcal_credentials?: GcalCredentials;
}

/**
 * Get Google Calendar OAuth tokens from secrets file.
 * Returns null if not authenticated.
 */
export async function getGcalTokens(): Promise<GcalTokens | null> {
  try {
    const content = await Deno.readTextFile(SECRETS_FILE);
    const secrets: SecretsFile = JSON.parse(content);
    return secrets.gcal ?? null;
  } catch {
    // File doesn't exist or is invalid
    return null;
  }
}

/**
 * Save Google Calendar OAuth tokens to secrets file.
 * Creates the file if it doesn't exist.
 */
export async function saveGcalTokens(tokens: GcalTokens): Promise<void> {
  await ensureDir(CONFIG_DIR);

  // Read existing secrets
  let secrets: SecretsFile = {};
  try {
    const content = await Deno.readTextFile(SECRETS_FILE);
    secrets = JSON.parse(content);
  } catch {
    // File doesn't exist or is invalid - start fresh
  }

  // Update gcal tokens
  secrets.gcal = tokens;

  // Write back to file with restrictive permissions
  await Deno.writeTextFile(
    SECRETS_FILE,
    JSON.stringify(secrets, null, 2) + "\n",
  );

  // Set file permissions to 600 (owner read/write only)
  try {
    await Deno.chmod(SECRETS_FILE, 0o600);
  } catch {
    // chmod may fail on some systems (e.g., Windows)
    logger.warn(
      "Could not set restrictive permissions on secrets file",
      "gcal",
    );
  }

  logger.info("Saved Google Calendar tokens", "gcal");
}

/**
 * Clear Google Calendar OAuth tokens from secrets file.
 */
export async function clearGcalTokens(): Promise<void> {
  try {
    const content = await Deno.readTextFile(SECRETS_FILE);
    const secrets: SecretsFile = JSON.parse(content);
    delete secrets.gcal;

    // Write back without gcal tokens
    await Deno.writeTextFile(
      SECRETS_FILE,
      JSON.stringify(secrets, null, 2) + "\n",
    );

    logger.info("Cleared Google Calendar tokens", "gcal");
  } catch {
    // File doesn't exist or is invalid - nothing to clear
  }
}

/**
 * Check if Google Calendar tokens are valid (not expired).
 * Returns false if tokens are expired or will expire within 5 minutes.
 */
export function areTokensValid(tokens: GcalTokens): boolean {
  const expiryDate = new Date(tokens.expiry);
  const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
  return expiryDate.getTime() > Date.now() + bufferMs;
}

/**
 * Get Google Calendar OAuth credentials from secrets file.
 * Returns null if not configured.
 */
export async function getGcalCredentials(): Promise<GcalCredentials | null> {
  try {
    const content = await Deno.readTextFile(SECRETS_FILE);
    const secrets: SecretsFile = JSON.parse(content);
    return secrets.gcal_credentials ?? null;
  } catch {
    return null;
  }
}

/**
 * Save Google Calendar OAuth credentials to secrets file.
 */
export async function saveGcalCredentials(
  credentials: GcalCredentials,
): Promise<void> {
  await ensureDir(CONFIG_DIR);

  // Read existing secrets
  let secrets: SecretsFile = {};
  try {
    const content = await Deno.readTextFile(SECRETS_FILE);
    secrets = JSON.parse(content);
  } catch {
    // File doesn't exist or is invalid - start fresh
  }

  // Update credentials
  secrets.gcal_credentials = credentials;

  // Write back to file with restrictive permissions
  await Deno.writeTextFile(
    SECRETS_FILE,
    JSON.stringify(secrets, null, 2) + "\n",
  );

  // Set file permissions to 600 (owner read/write only)
  try {
    await Deno.chmod(SECRETS_FILE, 0o600);
  } catch {
    // chmod may fail on some systems (e.g., Windows)
    logger.warn(
      "Could not set restrictive permissions on secrets file",
      "gcal",
    );
  }

  logger.info("Saved Google Calendar credentials", "gcal");
}

export { SECRETS_FILE };
