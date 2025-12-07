/**
 * Embedding Module Exports
 *
 * Factory for creating embedding providers based on configuration.
 */

export {
  EMBEDDING_DIMENSIONS,
  type EmbeddingConfig,
  type EmbeddingProvider,
  embeddingToVector,
  getEmbeddingConfig,
  normalizeEmbedding,
  type ProviderType,
} from "./provider.ts";

export { OpenAIEmbeddingProvider } from "./openai.ts";
export { OllamaEmbeddingProvider } from "./ollama.ts";
export { GeminiEmbeddingProvider } from "./gemini.ts";

import type { EmbeddingConfig, EmbeddingProvider } from "./provider.ts";
import { OpenAIEmbeddingProvider } from "./openai.ts";
import { OllamaEmbeddingProvider } from "./ollama.ts";
import { GeminiEmbeddingProvider } from "./gemini.ts";

/**
 * Create an embedding provider based on configuration.
 * Returns null if provider cannot be created (missing API keys, etc.)
 */
export function createEmbeddingProvider(
  config: EmbeddingConfig,
): EmbeddingProvider | null {
  switch (config.provider) {
    case "openai":
      if (!config.openaiApiKey) {
        console.warn(
          "OpenAI provider selected but OPENAI_API_KEY not set",
        );
        return null;
      }
      return new OpenAIEmbeddingProvider(
        config.openaiApiKey,
        config.openaiModel,
      );

    case "gemini":
      if (!config.geminiApiKey) {
        console.warn(
          "Gemini provider selected but GEMINI_API_KEY not set",
        );
        return null;
      }
      return new GeminiEmbeddingProvider(
        config.geminiApiKey,
        config.geminiDimensions,
      );

    case "ollama":
    default:
      return new OllamaEmbeddingProvider(
        config.ollamaUrl,
        config.ollamaModel,
      );
  }
}
