import type { Argv } from "yargs";
import { startServer } from "../../server/server.ts";
import { startTui } from "../../tui/app.tsx";

interface TuiArgs {
  attach?: string;
  port?: number;
}

export const tuiCommand = {
  command: "tui",
  describe: "Start interactive TUI",
  builder: (yargs: Argv) =>
    yargs
      .option("attach", {
        type: "string",
        describe: "Attach to existing server URL",
      })
      .option("port", {
        type: "number",
        describe: "Port for the server (if not attaching)",
        default: 0,
      }),
  handler: async (args: TuiArgs) => {
    let serverUrl: string;

    if (args.attach) {
      serverUrl = args.attach;
    } else {
      // Start server in background (TUI handles sync itself with user feedback)
      const server = await startServer({
        port: args.port ?? 0,
        hostname: "127.0.0.1",
        quiet: true,
        enableSync: false,
      });
      const addr = server.addr as Deno.NetAddr;
      serverUrl = `http://${addr.hostname}:${addr.port}`;
    }

    await startTui(serverUrl);
  },
};
