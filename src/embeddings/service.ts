/**
 * Embedding Service
 *
 * High-level service for embedding tasks and performing semantic search.
 */

import type { Client } from "@libsql/client/node";
import {
  createEmbeddingProvider,
  type EmbeddingConfig,
  type EmbeddingProvider,
  embeddingToVector,
  getEmbeddingConfig,
} from "./index.ts";
import {
  getDb,
  migrateCommentEmbeddings,
  migrateEmbeddings,
} from "../db/client.ts";
import { logger } from "../shared/logger.ts";
import { assertDefined, assertPositive } from "../shared/assert.ts";

export class EmbeddingService {
  private provider: EmbeddingProvider | null = null;
  private db: Client | null = null;
  private initialized = false;

  constructor(private config?: EmbeddingConfig) {}

  /** Initialize the service (lazy) */
  private async init(): Promise<boolean> {
    if (this.initialized) {
      return this.provider !== null;
    }

    this.initialized = true;

    // Get config from env if not provided
    const config = this.config || getEmbeddingConfig();
    if (!config) {
      return false;
    }

    // Create provider
    this.provider = createEmbeddingProvider(config);
    if (!this.provider) {
      return false;
    }

    // Get database and run migrations
    this.db = await getDb();
    await migrateEmbeddings();
    await migrateCommentEmbeddings();

    return true;
  }

  /** Check if embedding service is available */
  async isAvailable(): Promise<boolean> {
    return await this.init();
  }

  /**
   * Generate and store embedding for a task.
   * Combines title, description, and tags for richer embeddings.
   */
  async embedTask(
    taskId: number,
    title: string,
    description?: string | null,
    tags?: string[],
  ): Promise<void> {
    if (!(await this.init())) {
      return; // Silently skip if not configured
    }

    // Combine title, description, and tags
    let text = title;
    if (description) {
      text += `\n\n${description}`;
    }
    if (tags && tags.length > 0) {
      text += `\n\nTags: ${tags.join(", ")}`;
    }

    try {
      assertDefined(
        this.provider,
        "Provider must be initialized",
        "embeddings",
      );
      assertDefined(this.db, "Database must be initialized", "embeddings");

      const embedding = await this.provider.embed(text);
      const vectorStr = embeddingToVector(embedding);

      await this.db.execute({
        sql: `UPDATE tasks SET embedding = vector(?) WHERE id = ?`,
        args: [vectorStr, taskId],
      });
    } catch (error) {
      logger.error(`Failed to embed task #${taskId}`, "embeddings", {
        error: String(error),
      });
      // Don't throw - embedding failures shouldn't break task operations
    }
  }

  /**
   * Generate and store embedding for a comment.
   */
  async embedComment(commentId: number, content: string): Promise<void> {
    if (!(await this.init())) {
      return; // Silently skip if not configured
    }

    try {
      assertDefined(
        this.provider,
        "Provider must be initialized",
        "embeddings",
      );
      assertDefined(this.db, "Database must be initialized", "embeddings");

      const embedding = await this.provider.embed(content);
      const vectorStr = embeddingToVector(embedding);

      await this.db.execute({
        sql: `UPDATE comments SET embedding = vector(?) WHERE id = ?`,
        args: [vectorStr, commentId],
      });
    } catch (error) {
      logger.error(`Failed to embed comment #${commentId}`, "embeddings", {
        error: String(error),
      });
    }
  }

  /**
   * Perform semantic search for tasks.
   * Searches both task content and comment content, returning unique task IDs.
   */
  async searchSimilar(
    query: string,
    limit = 10,
  ): Promise<number[]> {
    if (!(await this.init())) {
      throw new Error("Embedding service not configured");
    }

    // Generate query embedding
    assertDefined(this.provider, "Provider must be initialized", "embeddings");
    assertDefined(this.db, "Database must be initialized", "embeddings");
    assertPositive(limit, "Limit must be positive", "embeddings");

    const embedding = await this.provider.embed(query);
    const vectorStr = embeddingToVector(embedding);

    // Search tasks directly - vector_top_k returns id only, calculate distance separately
    // Note: k parameter must be interpolated directly as vector_top_k doesn't accept bound parameters for k
    const k = Math.max(1, Math.floor(limit));
    const taskResult = await this.db.execute({
      sql: `
        SELECT t.id, vector_distance_cos(t.embedding, vector(?)) as distance
        FROM vector_top_k('tasks_embedding_idx', vector(?), ${k}) v
        JOIN tasks t ON t.id = v.id
      `,
      args: [vectorStr, vectorStr],
    });

    // Search comments and get their parent task_ids
    const commentResult = await this.db.execute({
      sql: `
        SELECT c.task_id as id, vector_distance_cos(c.embedding, vector(?)) as distance
        FROM vector_top_k('comments_embedding_idx', vector(?), ${k}) v
        JOIN comments c ON c.id = v.id
      `,
      args: [vectorStr, vectorStr],
    });

    // Merge results, keeping best distance per task_id
    const taskDistances = new Map<number, number>();

    for (const row of taskResult.rows) {
      const taskId = row.id as number;
      const distance = row.distance as number;
      const existing = taskDistances.get(taskId);
      if (existing === undefined || distance < existing) {
        taskDistances.set(taskId, distance);
      }
    }

    for (const row of commentResult.rows) {
      const taskId = row.id as number;
      const distance = row.distance as number;
      const existing = taskDistances.get(taskId);
      if (existing === undefined || distance < existing) {
        taskDistances.set(taskId, distance);
      }
    }

    // Sort by distance (ascending = most similar first) and limit
    const sorted = Array.from(taskDistances.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, limit)
      .map(([taskId]) => taskId);

    return sorted;
  }

  /**
   * Backfill embeddings for all tasks that don't have them.
   * Returns counts of processed and failed tasks.
   */
  async backfillAll(
    onProgress?: (current: number, total: number) => void,
  ): Promise<{ processed: number; failed: number; skipped: number }> {
    if (!(await this.init())) {
      throw new Error("Embedding service not configured");
    }

    // Get tasks without embeddings
    assertDefined(this.db, "Database must be initialized", "embeddings");
    const result = await this.db.execute(`
      SELECT id, title, description FROM tasks WHERE embedding IS NULL
    `);

    const tasks = result.rows as unknown as Array<{
      id: number;
      title: string;
      description: string | null;
    }>;

    // Get tags for all tasks in a single query
    const tagsResult = await this.db.execute(`
      SELECT tt.task_id, GROUP_CONCAT(tg.name, ', ') as tag_names
      FROM task_tags tt
      JOIN tags tg ON tt.tag_id = tg.id
      GROUP BY tt.task_id
    `);
    const taskTags = new Map<number, string>(
      tagsResult.rows.map((r) => [
        r.task_id as number,
        r.tag_names as string,
      ]),
    );

    let processed = 0;
    let failed = 0;

    // Process in batches for efficiency
    const batchSize = 10;
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);

      // Prepare texts for batch embedding (including tags)
      const texts = batch.map((t) => {
        let text = t.title;
        if (t.description) {
          text += `\n\n${t.description}`;
        }
        const tags = taskTags.get(t.id);
        if (tags) {
          text += `\n\nTags: ${tags}`;
        }
        return text;
      });

      try {
        assertDefined(
          this.provider,
          "Provider must be initialized",
          "embeddings",
        );
        const embeddings = await this.provider.embedBatch(texts);

        // Store each embedding
        for (let j = 0; j < batch.length; j++) {
          try {
            const vectorStr = embeddingToVector(embeddings[j]);
            await this.db.execute({
              sql: `UPDATE tasks SET embedding = vector(?) WHERE id = ?`,
              args: [vectorStr, batch[j].id],
            });
            processed++;
          } catch (error) {
            logger.error(
              `Failed to store embedding for task #${batch[j].id}`,
              "embeddings",
              { error: String(error) },
            );
            failed++;
          }
        }
      } catch (error) {
        logger.error("Batch embedding failed", "embeddings", {
          error: String(error),
        });
        failed += batch.length;
      }

      onProgress?.(i + batch.length, tasks.length);
    }

    return {
      processed,
      failed,
      skipped: tasks.length === 0 ? 0 : 0, // All tasks attempted
    };
  }

  /**
   * Get embedding coverage statistics.
   */
  async getStats(): Promise<{
    total: number;
    withEmbedding: number;
    withoutEmbedding: number;
    provider: string | null;
    comments: {
      total: number;
      withEmbedding: number;
      withoutEmbedding: number;
    };
  }> {
    await this.init();

    const db = this.db || (await getDb());

    const totalResult = await db.execute("SELECT COUNT(*) as count FROM tasks");
    const total = Number(totalResult.rows[0].count);

    const withResult = await db.execute(
      "SELECT COUNT(*) as count FROM tasks WHERE embedding IS NOT NULL",
    );
    const withEmbedding = Number(withResult.rows[0].count);

    // Comment stats
    const commentTotalResult = await db.execute(
      "SELECT COUNT(*) as count FROM comments",
    );
    const commentTotal = Number(commentTotalResult.rows[0].count);

    const commentWithResult = await db.execute(
      "SELECT COUNT(*) as count FROM comments WHERE embedding IS NOT NULL",
    );
    const commentWithEmbedding = Number(commentWithResult.rows[0].count);

    return {
      total,
      withEmbedding,
      withoutEmbedding: total - withEmbedding,
      provider: this.provider?.name || null,
      comments: {
        total: commentTotal,
        withEmbedding: commentWithEmbedding,
        withoutEmbedding: commentTotal - commentWithEmbedding,
      },
    };
  }
}

// Singleton instance
let embeddingService: EmbeddingService | null = null;

/** Get the global embedding service instance */
export function getEmbeddingService(): EmbeddingService {
  if (!embeddingService) {
    embeddingService = new EmbeddingService();
  }
  return embeddingService;
}
