import { startServer } from "../server/server.ts";
import { createClient, TaskClient } from "../sdk/client.ts";
import { AssertionError } from "../shared/assert.ts";

let serverInstance: Deno.HttpServer | null = null;
let serverUrl: string | null = null;

export interface BootstrapOptions {
  attach?: string;
  port?: number;
}

export async function getClient(
  options: BootstrapOptions = {},
): Promise<TaskClient> {
  // If attaching to external server
  if (options.attach) {
    return createClient({ baseUrl: options.attach });
  }

  // Start in-process server if not already running
  if (!serverInstance) {
    const port = options.port ?? 0; // Use 0 for random available port
    const hostname = "127.0.0.1";

    serverInstance = await startServer({ port, hostname, quiet: true });

    // Get the actual port assigned
    const addr = serverInstance.addr as Deno.NetAddr;
    serverUrl = `http://${addr.hostname}:${addr.port}`;
  }

  if (!serverUrl) {
    throw new Error("Server URL not available - server should be running");
  }
  return createClient({ baseUrl: serverUrl });
}

export async function shutdown(): Promise<void> {
  if (serverInstance) {
    await serverInstance.shutdown();
    serverInstance = null;
    serverUrl = null;
  }
}

export async function runWithClient<T>(
  options: BootstrapOptions,
  fn: (client: TaskClient) => Promise<T>,
): Promise<T> {
  const client = await getClient(options);
  try {
    return await fn(client);
  } catch (error) {
    // Assertion failures indicate programmer errors - crash with clear message.
    if (error instanceof AssertionError) {
      console.error(`\nASSERTION FAILED: ${error.message}`);
      console.error("This is a bug. Please report it.");
      if (error.context) {
        console.error(`Context: ${error.context}`);
      }
      Deno.exit(1);
    }
    throw error;
  } finally {
    // Only shutdown if we started an in-process server
    if (!options.attach) {
      await shutdown();
    }
  }
}
