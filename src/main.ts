import yargs from "yargs";
import { APP_VERSION } from "./shared/version.ts";
import { addCommand } from "./cli/cmd/add.ts";
import { batchAddCommand } from "./cli/cmd/batch-add.ts";
import { listCommand } from "./cli/cmd/list.ts";
import { viewCommand } from "./cli/cmd/view.ts";
import { updateCommand } from "./cli/cmd/update.ts";
import { commentCommand } from "./cli/cmd/comment.ts";
import { attachFileCommand } from "./cli/cmd/attach.ts";
import { serveCommand } from "./cli/cmd/serve.ts";
import { tuiCommand } from "./cli/cmd/tui.ts";
import { truncateCommand } from "./cli/cmd/truncate.ts";
import { statsCommand } from "./cli/cmd/stats.ts";
import { reportCommand } from "./cli/cmd/report.ts";
import { bulkCommand } from "./cli/cmd/bulk.ts";
import { completeSubtasksCommand } from "./cli/cmd/complete-subtasks.ts";
import { embeddingsCommand } from "./cli/cmd/embeddings.ts";
import { shareCommand } from "./cli/cmd/share.ts";
import { tagCommand } from "./cli/cmd/tag.ts";
import { workCommand } from "./cli/cmd/work.ts";
import { syncCommand } from "./cli/cmd/sync.ts";
import { dbCommand } from "./cli/cmd/db.ts";
import { gcalCommand } from "./cli/cmd/gcal.ts";
import { upgradeCommand } from "./cli/cmd/upgrade.ts";

// In Deno, Deno.args already contains just the args (no script path)
await yargs(Deno.args)
  .scriptName("task")
  .version(APP_VERSION)
  .usage("$0 <command> [options]")
  .command(addCommand)
  .command(batchAddCommand)
  .command(listCommand)
  .command(viewCommand)
  .command(updateCommand)
  .command(commentCommand)
  .command(attachFileCommand)
  .command(serveCommand)
  .command(tuiCommand)
  .command(truncateCommand)
  .command(statsCommand)
  .command(reportCommand)
  .command(bulkCommand)
  .command(completeSubtasksCommand)
  .command(embeddingsCommand)
  .command(shareCommand)
  .command(tagCommand)
  .command(workCommand)
  .command(syncCommand)
  .command(dbCommand)
  .command(gcalCommand)
  .command(upgradeCommand)
  .demandCommand(1, "Please specify a command")
  .strict()
  .help()
  .parse();
