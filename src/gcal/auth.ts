/**
 * Google Calendar OAuth 2.0 authentication flow.
 *
 * Implements the OAuth 2.0 authorization code flow:
 * 1. Start local callback server
 * 2. Open browser for user consent
 * 3. Exchange code for tokens
 * 4. Store tokens securely
 */

import { logger } from "../shared/logger.ts";
import { assert, assertDefined } from "../shared/assert.ts";
import { GCAL_AUTH_PORT, GCAL_AUTH_TIMEOUT_MS } from "../shared/limits.ts";
import {
  areTokensValid,
  clearGcalTokens,
  type GcalTokens,
  getGcalCredentials,
  getGcalTokens,
  saveGcalCredentials,
  saveGcalTokens,
} from "./secrets.ts";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export interface GcalAuthConfig {
  clientId: string;
  clientSecret: string;
}

export class GcalAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GcalAuthError";
  }
}

/**
 * Get OAuth credentials from secrets file or environment variables.
 * Environment variables take precedence if set.
 */
export async function getAuthConfig(): Promise<GcalAuthConfig> {
  // Check environment variables first
  const envClientId = Deno.env.get("GCAL_CLIENT_ID");
  const envClientSecret = Deno.env.get("GCAL_CLIENT_SECRET");

  if (envClientId && envClientSecret) {
    return { clientId: envClientId, clientSecret: envClientSecret };
  }

  // Check stored credentials
  const stored = await getGcalCredentials();
  if (stored) {
    return { clientId: stored.client_id, clientSecret: stored.client_secret };
  }

  throw new GcalAuthError(
    "Google Calendar credentials not configured.\n" +
      "Run 'task gcal auth' to set up authentication.",
  );
}

/**
 * Prompt user for OAuth credentials and save them.
 */
export async function promptForCredentials(): Promise<GcalAuthConfig> {
  console.log("\nGoogle Calendar Setup");
  console.log("=====================");
  console.log("You need OAuth credentials from Google Cloud Console.");
  console.log("See: https://console.cloud.google.com/apis/credentials\n");

  const clientId = prompt("Enter Client ID:")?.trim();
  if (!clientId) {
    throw new GcalAuthError("Client ID is required");
  }

  const clientSecret = prompt("Enter Client Secret:")?.trim();
  if (!clientSecret) {
    throw new GcalAuthError("Client Secret is required");
  }

  // Save credentials
  await saveGcalCredentials({
    client_id: clientId,
    client_secret: clientSecret,
  });

  console.log("\nCredentials saved to ~/.task-cli/secrets.json\n");

  return { clientId, clientSecret };
}

/**
 * Check if the app is authenticated with Google Calendar.
 */
export async function isAuthenticated(): Promise<boolean> {
  const tokens = await getGcalTokens();
  return tokens !== null;
}

/**
 * Get valid access token, refreshing if necessary.
 */
export async function getValidAccessToken(): Promise<string> {
  const tokens = await getGcalTokens();

  if (!tokens) {
    throw new GcalAuthError(
      "Not authenticated with Google Calendar. Run 'task gcal auth' first.",
    );
  }

  if (areTokensValid(tokens)) {
    return tokens.access_token;
  }

  // Token expired, try to refresh
  logger.info("Access token expired, refreshing...", "gcal");
  const newTokens = await refreshAccessToken(tokens.refresh_token);
  await saveGcalTokens(newTokens);
  return newTokens.access_token;
}

/**
 * Start the OAuth 2.0 authorization flow.
 * Opens browser for user consent and waits for callback.
 * Prompts for credentials if not already configured.
 */
export async function startAuthFlow(): Promise<GcalTokens> {
  // Try to get existing credentials, or prompt for new ones
  let config: GcalAuthConfig;
  try {
    config = await getAuthConfig();
  } catch {
    config = await promptForCredentials();
  }
  const port = Number(Deno.env.get("GCAL_AUTH_PORT")) || GCAL_AUTH_PORT;
  const redirectUri = `http://localhost:${port}/callback`;

  // Generate state for CSRF protection
  const state = crypto.randomUUID();

  // Build authorization URL
  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  // Create promise for authorization code
  let resolveCode: (code: string) => void;
  let rejectCode: (error: Error) => void;
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  // Start local server to receive callback
  const server = Deno.serve({ port, onListen: () => {} }, (req) => {
    const url = new URL(req.url);

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        rejectCode(new GcalAuthError(`Authorization failed: ${error}`));
        return new Response(
          htmlResponse(
            "Authorization Failed",
            `Error: ${error}. You can close this window.`,
          ),
          { headers: { "Content-Type": "text/html" } },
        );
      }

      if (returnedState !== state) {
        rejectCode(
          new GcalAuthError("Invalid state parameter (CSRF protection)"),
        );
        return new Response(
          htmlResponse(
            "Authorization Failed",
            "Invalid state. You can close this window.",
          ),
          { headers: { "Content-Type": "text/html" } },
        );
      }

      if (!code) {
        rejectCode(new GcalAuthError("No authorization code received"));
        return new Response(
          htmlResponse(
            "Authorization Failed",
            "No code received. You can close this window.",
          ),
          { headers: { "Content-Type": "text/html" } },
        );
      }

      resolveCode(code);
      return new Response(
        htmlResponse(
          "Authorization Successful",
          "You can close this window and return to the terminal.",
        ),
        { headers: { "Content-Type": "text/html" } },
      );
    }

    return new Response("Not found", { status: 404 });
  });

  // Open browser
  console.log("\nOpening browser for Google Calendar authorization...");
  console.log(`If browser doesn't open, visit: ${authUrl.toString()}\n`);

  try {
    await openBrowser(authUrl.toString());
  } catch {
    logger.warn("Could not open browser automatically", "gcal");
  }

  // Wait for code with timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new GcalAuthError("Authorization timed out. Please try again."));
    }, GCAL_AUTH_TIMEOUT_MS);
  });

  try {
    const code = await Promise.race([codePromise, timeoutPromise]);

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, redirectUri, config);
    await saveGcalTokens(tokens);

    console.log("Successfully authenticated with Google Calendar!");

    // Shutdown server (don't await - it can hang on open connections)
    server.shutdown().catch(() => {});

    return tokens;
  } catch (error) {
    // Shutdown server on error too
    server.shutdown().catch(() => {});
    throw error;
  }
}

/**
 * Exchange authorization code for access and refresh tokens.
 */
async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  config: GcalAuthConfig,
): Promise<GcalTokens> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new GcalAuthError(`Token exchange failed: ${error}`);
  }

  const data = await response.json();

  assert(
    typeof data.access_token === "string",
    "Response must contain access_token",
    "gcal",
  );
  assertDefined(
    data.refresh_token,
    "Response must contain refresh_token",
    "gcal",
  );

  // Calculate expiry time
  const expiresInMs = (data.expires_in ?? 3600) * 1000;
  const expiry = new Date(Date.now() + expiresInMs).toISOString();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry,
    token_type: data.token_type ?? "Bearer",
  };
}

/**
 * Refresh access token using refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<GcalTokens> {
  const config = await getAuthConfig();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new GcalAuthError(`Token refresh failed: ${error}`);
  }

  const data = await response.json();

  assert(
    typeof data.access_token === "string",
    "Response must contain access_token",
    "gcal",
  );

  // Calculate expiry time
  const expiresInMs = (data.expires_in ?? 3600) * 1000;
  const expiry = new Date(Date.now() + expiresInMs).toISOString();

  return {
    access_token: data.access_token,
    // Keep existing refresh token if not provided
    refresh_token: data.refresh_token ?? refreshToken,
    expiry,
    token_type: data.token_type ?? "Bearer",
  };
}

/**
 * Logout from Google Calendar (clear tokens).
 */
export async function logout(): Promise<void> {
  await clearGcalTokens();
  console.log("Logged out from Google Calendar.");
}

/**
 * Open URL in default browser.
 */
async function openBrowser(url: string): Promise<void> {
  const os = Deno.build.os;
  let command: string;
  let args: string[];

  switch (os) {
    case "darwin":
      command = "open";
      args = [url];
      break;
    case "linux":
      command = "xdg-open";
      args = [url];
      break;
    case "windows":
      command = "cmd";
      args = ["/c", "start", "", url];
      break;
    default:
      throw new Error(`Unsupported OS: ${os}`);
  }

  const cmd = new Deno.Command(command, { args });
  await cmd.output();
}

/**
 * Generate HTML response for OAuth callback.
 */
function htmlResponse(title: string, message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 { color: #333; margin-bottom: 10px; }
    p { color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
