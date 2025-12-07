/**
 * OpenAI Embedding Provider
 *
 * Uses text-embedding-3-small model (1536 dims, truncated to 768).
 * MRL-trained, so truncation preserves quality.
 */

import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingProvider,
  normalizeEmbedding,
} from "./provider.ts";

const OPENAI_API_URL = "https://api.openai.com/v1/embeddings";

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
  readonly dimensions = EMBEDDING_DIMENSIONS;

  constructor(
    private apiKey: string,
    private model: string = "text-embedding-3-small",
  ) {
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }
  }

  async embed(text: string): Promise<number[]> {
    const embeddings = await this.embedBatch([text]);
    return embeddings[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        // Request exact dimensions if model supports it (3-small does)
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data: OpenAIEmbeddingResponse = await response.json();

    // Sort by index to maintain order
    const sorted = data.data.sort((a, b) => a.index - b.index);

    return sorted.map((item) =>
      normalizeEmbedding(item.embedding, EMBEDDING_DIMENSIONS)
    );
  }
}
