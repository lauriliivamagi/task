import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getAttachmentsDir, getDb } from "../../db/client.ts";
import { copy } from "@std/fs";
import { basename, join } from "@std/path";

export const attachmentsRoute = new Hono();

const AttachFileInput = z.object({
  filepath: z.string(),
});

// List attachments for a task
attachmentsRoute.get("/", async (c) => {
  const taskId = Number(c.req.param("taskId"));
  const db = await getDb();

  const result = await db.execute({
    sql: "SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at ASC",
    args: [taskId],
  });

  return c.json(result.rows);
});

// Add attachment to task
attachmentsRoute.post(
  "/",
  zValidator("json", AttachFileInput),
  async (c) => {
    const taskId = Number(c.req.param("taskId"));
    const { filepath } = c.req.valid("json");
    const db = await getDb();

    // Check if task exists
    const taskResult = await db.execute({
      sql: "SELECT id FROM tasks WHERE id = ?",
      args: [taskId],
    });

    if (taskResult.rows.length === 0) {
      return c.json({ error: `Task #${taskId} not found` }, 404);
    }

    // Check if file exists
    try {
      await Deno.stat(filepath);
    } catch {
      return c.json({ error: `File not found: ${filepath}` }, 400);
    }

    const filename = basename(filepath);
    const destination = join(
      getAttachmentsDir(),
      `${taskId}_${Date.now()}_${filename}`,
    );

    await copy(filepath, destination);

    const result = await db.execute({
      sql:
        "INSERT INTO attachments (task_id, filename, path) VALUES (?, ?, ?) RETURNING *",
      args: [taskId, filename, destination],
    });

    return c.json(result.rows[0], 201);
  },
);

// Delete attachment
attachmentsRoute.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = await getDb();

  // Get attachment path to delete file
  const attachmentResult = await db.execute({
    sql: "SELECT path FROM attachments WHERE id = ?",
    args: [id],
  });

  if (attachmentResult.rows.length > 0) {
    try {
      await Deno.remove(attachmentResult.rows[0].path as string);
    } catch {
      // File may not exist, continue with db deletion
    }
  }

  await db.execute({
    sql: "DELETE FROM attachments WHERE id = ?",
    args: [id],
  });

  return c.json({ deleted: true });
});
