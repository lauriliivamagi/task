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
 * Read the secrets file, tolerating a missing or invalid file.
 */
async function readSecrets(): Promise<SecretsFile> {
  try {
    const content = await Deno.readTextFile(SECRETS_FILE);
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Write the secrets file with owner-only permissions.
 * The mode is passed to the write itself so the file is never observable
 * with default (world-readable) permissions, even for an instant.
 */
async function writeSecrets(secrets: SecretsFile): Promise<void> {
  await ensureDir(CONFIG_DIR);
  try {
    await Deno.writeTextFile(
      SECRETS_FILE,
      JSON.stringify(secrets, null, 2) + "\n",
      { mode: 0o600 },
    );
  } catch (error) {
    // mode is unsupported on some platforms (e.g. Windows) - retry without
    if (error instanceof Deno.errors.NotSupported) {
      await Deno.writeTextFile(
        SECRETS_FILE,
        JSON.stringify(secrets, null, 2) + "\n",
      );
      logger.warn(
        "Could not set restrictive permissions on secrets file",
        "gcal",
      );
    } else {
      throw error;
    }
  }
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
  const secrets = await readSecrets();
  secrets.gcal = tokens;
  await writeSecrets(secrets);
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
    await writeSecrets(secrets);

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
  const expiry = Temporal.Instant.from(tokens.expiry);
  const threshold = Temporal.Now.instant().add({ minutes: 5 });
  return Temporal.Instant.compare(expiry, threshold) > 0;
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
  const secrets = await readSecrets();
  secrets.gcal_credentials = credentials;
  await writeSecrets(secrets);
  logger.info("Saved Google Calendar credentials", "gcal");
}

export { SECRETS_FILE };
