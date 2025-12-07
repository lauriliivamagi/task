import type { Argv } from "yargs";
import { startServer } from "../../server/server.ts";

interface ServeArgs {
  port?: number;
  hostname?: string;
}

export const serveCommand = {
  command: "serve",
  describe: "Start the task server",
  builder: (yargs: Argv) =>
    yargs
      .option("port", {
        type: "number",
        describe: "Port to listen on",
        default: 3000,
      })
      .option("hostname", {
        type: "string",
        describe: "Hostname to bind to",
        default: "127.0.0.1",
      }),
  handler: async (args: ServeArgs) => {
    await startServer({
      port: args.port,
      hostname: args.hostname,
      enableSync: true,
    });

    // Keep the process running
    await new Promise(() => {});
  },
};
