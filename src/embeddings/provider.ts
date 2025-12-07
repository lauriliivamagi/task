/**
 * Embedding Provider Interface
 *
 * Abstraction layer for different embedding providers (OpenAI, Ollama, Gemini).
 * All providers normalize to 768 dimensions for cross-provider compatibility.
 */

export const EMBEDDING_DIMENSIONS = 768;

export interface EmbeddingProvider {
  /** Generate embedding for a single text */
  embed(text: string): Promise<number[]>;

  /** Generate embeddings for multiple texts (batch) */
  embedBatch(texts: string[]): Promise<number[][]>;

  /** Number of dimensions in output embeddings */
  readonly dimensions: number;

  /** Provider name for logging/debugging */
  readonly name: string;
}

export type ProviderType = "openai" | "ollama" | "gemini";

export interface EmbeddingConfig {
  provider: ProviderType;

  // OpenAI settings
  openaiApiKey?: string;
  openaiModel?: string; // default: text-embedding-3-small

  // Ollama settings
  ollamaUrl?: string; // default: http://localhost:11434
  ollamaModel?: string; // default: nomic-embed-text

  // Gemini settings
  geminiApiKey?: string;
  geminiDimensions?: number; // default: 768
}

/** Read embedding config from environment variables */
export function getEmbeddingConfig(): EmbeddingConfig | null {
  const provider = Deno.env.get("TASK_CLI_EMBEDDING_PROVIDER") as
    | ProviderType
    | undefined;

  // If no provider specified and no API keys, return null (disabled)
  if (
    !provider &&
    !Deno.env.get("OPENAI_API_KEY") &&
    !Deno.env.get("GEMINI_API_KEY")
  ) {
    // Check if Ollama is available by default
    return {
      provider: "ollama",
      ollamaUrl: Deno.env.get("TASK_CLI_OLLAMA_URL") ||
        "http://localhost:11434",
      ollamaModel: Deno.env.get("TASK_CLI_OLLAMA_MODEL") || "nomic-embed-text",
    };
  }

  return {
    provider: provider || "ollama",

    // OpenAI
    openaiApiKey: Deno.env.get("OPENAI_API_KEY"),
    openaiModel: Deno.env.get("TASK_CLI_OPENAI_MODEL") ||
      "text-embedding-3-small",

    // Ollama
    ollamaUrl: Deno.env.get("TASK_CLI_OLLAMA_URL") || "http://localhost:11434",
    ollamaModel: Deno.env.get("TASK_CLI_OLLAMA_MODEL") || "nomic-embed-text",

    // Gemini
    geminiApiKey: Deno.env.get("GEMINI_API_KEY"),
    geminiDimensions: parseInt(
      Deno.env.get("TASK_CLI_GEMINI_DIMENSIONS") || "768",
    ),
  };
}

/** Normalize embedding to target dimensions (truncate or pad) */
export function normalizeEmbedding(
  embedding: number[],
  targetDims: number = EMBEDDING_DIMENSIONS,
): number[] {
  if (embedding.length === targetDims) {
    return embedding;
  }

  if (embedding.length > targetDims) {
    // Truncate (safe for MRL-trained models like OpenAI)
    return embedding.slice(0, targetDims);
  }

  // Pad with zeros (preserves cosine similarity)
  return [...embedding, ...new Array(targetDims - embedding.length).fill(0)];
}

/** Convert embedding array to vector string for SQL */
export function embeddingToVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
