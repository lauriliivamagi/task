/**
 * Ollama Embedding Provider
 *
 * Uses local Ollama instance for embeddings.
 * Default model: nomic-embed-text (768 dimensions).
 * Free, private, no API key required.
 */

import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingProvider,
  normalizeEmbedding,
} from "./provider.ts";

interface OllamaEmbeddingResponse {
  embedding: number[];
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name = "ollama";
  readonly dimensions = EMBEDDING_DIMENSIONS;

  constructor(
    private baseUrl: string = "http://localhost:11434",
    private model: string = "nomic-embed-text",
  ) {}

  async embed(text: string): Promise<number[]> {
    const url = `${this.baseUrl}/api/embeddings`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        prompt: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data: OllamaEmbeddingResponse = await response.json();
    return normalizeEmbedding(data.embedding, EMBEDDING_DIMENSIONS);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Ollama doesn't have native batch support, so we parallelize
    const results = await Promise.all(texts.map((text) => this.embed(text)));
    return results;
  }
}
