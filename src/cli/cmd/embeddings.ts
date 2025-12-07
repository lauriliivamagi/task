import type { Argv } from "yargs";
import { getEmbeddingService } from "../../embeddings/service.ts";
import { getEmbeddingConfig } from "../../embeddings/provider.ts";

interface EmbeddingsArgs {
  subcommand?: string;
}

export const embeddingsCommand = {
  command: "embeddings <subcommand>",
  describe: "Manage task embeddings for semantic search",
  builder: (yargs: Argv) =>
    yargs
      .positional("subcommand", {
        type: "string",
        choices: ["status", "backfill", "provider"],
        describe: "Subcommand to run",
      })
      .example("$0 embeddings status", "Show embedding coverage statistics")
      .example("$0 embeddings backfill", "Generate embeddings for all tasks")
      .example("$0 embeddings provider", "Show current provider configuration"),
  handler: async (args: EmbeddingsArgs) => {
    const service = getEmbeddingService();

    switch (args.subcommand) {
      case "status": {
        const stats = await service.getStats();
        console.log("Embedding Statistics:");
        console.log(`  Provider: ${stats.provider || "Not configured"}`);
        console.log("");
        console.log("Tasks:");
        console.log(`  Total: ${stats.total}`);
        console.log(`  With embeddings: ${stats.withEmbedding}`);
        console.log(`  Without embeddings: ${stats.withoutEmbedding}`);
        if (stats.total > 0) {
          const coverage = ((stats.withEmbedding / stats.total) * 100).toFixed(
            1,
          );
          console.log(`  Coverage: ${coverage}%`);
        }
        console.log("");
        console.log("Comments:");
        console.log(`  Total: ${stats.comments.total}`);
        console.log(`  With embeddings: ${stats.comments.withEmbedding}`);
        console.log(`  Without embeddings: ${stats.comments.withoutEmbedding}`);
        if (stats.comments.total > 0) {
          const coverage = (
            (stats.comments.withEmbedding / stats.comments.total) *
            100
          ).toFixed(1);
          console.log(`  Coverage: ${coverage}%`);
        }
        break;
      }

      case "backfill": {
        const isAvailable = await service.isAvailable();
        if (!isAvailable) {
          console.error(
            "Error: Embedding service not configured.",
          );
          console.error(
            "Set EMBEDDING_PROVIDER environment variable (ollama, openai, or gemini)",
          );
          console.error("and the required API key for your chosen provider.");
          Deno.exit(1);
        }

        console.log("Starting embedding backfill...");

        const result = await service.backfillAll((current, total) => {
          const pct = ((current / total) * 100).toFixed(0);
          // Use carriage return for progress on same line
          Deno.stdout.writeSync(
            new TextEncoder().encode(
              `\r  Progress: ${current}/${total} (${pct}%)`,
            ),
          );
        });

        console.log(""); // New line after progress
        console.log("Backfill complete:");
        console.log(`  Processed: ${result.processed}`);
        console.log(`  Failed: ${result.failed}`);
        console.log(`  Skipped: ${result.skipped}`);
        break;
      }

      case "provider": {
        const config = getEmbeddingConfig();
        if (!config) {
          console.log("No embedding provider configured.");
          console.log("");
          console.log("To enable embeddings, set these environment variables:");
          console.log("");
          console.log("  EMBEDDING_PROVIDER=ollama|openai|gemini");
          console.log("");
          console.log("For Ollama (local, free):");
          console.log("  OLLAMA_URL=http://localhost:11434 (default)");
          console.log("  OLLAMA_MODEL=nomic-embed-text (default)");
          console.log("");
          console.log("For OpenAI:");
          console.log("  OPENAI_API_KEY=sk-...");
          console.log(
            "  OPENAI_EMBEDDING_MODEL=text-embedding-3-small (default)",
          );
          console.log("");
          console.log("For Gemini:");
          console.log("  GEMINI_API_KEY=...");
          console.log("  GEMINI_EMBEDDING_DIMENSIONS=768 (default, max 3072)");
          return;
        }

        console.log("Embedding Provider Configuration:");
        console.log(`  Provider: ${config.provider}`);

        switch (config.provider) {
          case "ollama":
            console.log(`  URL: ${config.ollamaUrl}`);
            console.log(`  Model: ${config.ollamaModel}`);
            break;
          case "openai":
            console.log(`  Model: ${config.openaiModel}`);
            console.log(
              `  API Key: ${
                config.openaiApiKey ? "***configured***" : "NOT SET"
              }`,
            );
            break;
          case "gemini":
            console.log(`  Dimensions: ${config.geminiDimensions}`);
            console.log(
              `  API Key: ${
                config.geminiApiKey ? "***configured***" : "NOT SET"
              }`,
            );
            break;
        }

        // Test if service is actually available
        const isAvailable = await service.isAvailable();
        console.log(`  Status: ${isAvailable ? "Ready" : "Not available"}`);
        break;
      }

      default:
        console.error(`Unknown subcommand: ${args.subcommand}`);
        console.error("Use: embeddings status | backfill | provider");
        Deno.exit(1);
    }
  },
};
