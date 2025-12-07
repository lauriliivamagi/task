/**
 * Gemini Embedding Provider
 *
 * Uses gemini-embedding-001 model.
 * Supports configurable dimensions (768, 1536, 3072).
 * Supports task types for optimized embeddings.
 */

import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingProvider,
  normalizeEmbedding,
} from "./provider.ts";

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

type TaskType =
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY"
  | "SEMANTIC_SIMILARITY";

interface GeminiEmbeddingResponse {
  embedding: {
    values: number[];
  };
}

interface GeminiBatchEmbeddingResponse {
  embeddings: Array<{
    values: number[];
  }>;
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = "gemini";
  readonly dimensions = EMBEDDING_DIMENSIONS;

  constructor(
    private apiKey: string,
    private outputDimensions: number = EMBEDDING_DIMENSIONS,
  ) {
    if (!apiKey) {
      throw new Error("Gemini API key is required");
    }
  }

  async embed(
    text: string,
    taskType: TaskType = "RETRIEVAL_DOCUMENT",
  ): Promise<number[]> {
    const url =
      `${GEMINI_API_BASE}/gemini-embedding-001:embedContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: {
          parts: [{ text }],
        },
        taskType,
        outputDimensionality: this.outputDimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data: GeminiEmbeddingResponse = await response.json();
    return normalizeEmbedding(data.embedding.values, EMBEDDING_DIMENSIONS);
  }

  async embedBatch(
    texts: string[],
    taskType: TaskType = "RETRIEVAL_DOCUMENT",
  ): Promise<number[][]> {
    const url =
      `${GEMINI_API_BASE}/gemini-embedding-001:batchEmbedContents?key=${this.apiKey}`;

    const requests = texts.map((text) => ({
      model: "models/gemini-embedding-001",
      content: {
        parts: [{ text }],
      },
      taskType,
      outputDimensionality: this.outputDimensions,
    }));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data: GeminiBatchEmbeddingResponse = await response.json();
    return data.embeddings.map((e) =>
      normalizeEmbedding(e.values, EMBEDDING_DIMENSIONS)
    );
  }

  /** Embed a search query (uses RETRIEVAL_QUERY task type) */
  embedQuery(text: string): Promise<number[]> {
    return this.embed(text, "RETRIEVAL_QUERY");
  }
}
