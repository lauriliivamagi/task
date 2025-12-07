import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getDb } from "../../db/client.ts";
import { CreateProjectInput } from "../../shared/schemas.ts";

export const projectsRoute = new Hono();

// List projects
projectsRoute.get("/", async (c) => {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM projects ORDER BY created_at DESC",
    args: [],
  });
  return c.json(result.rows);
});

// Create project
projectsRoute.post(
  "/",
  zValidator("json", CreateProjectInput),
  async (c) => {
    const input = c.req.valid("json");
    const db = await getDb();

    const result = await db.execute({
      sql: "INSERT INTO projects (name, description) VALUES (?, ?) RETURNING *",
      args: [input.name, input.description || null],
    });

    return c.json(result.rows[0], 201);
  },
);

// Get single project
projectsRoute.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = await getDb();

  const result = await db.execute({
    sql: "SELECT * FROM projects WHERE id = ?",
    args: [id],
  });

  if (result.rows.length === 0) {
    return c.json({ error: `Project #${id} not found` }, 404);
  }

  return c.json(result.rows[0]);
});

// Delete project
projectsRoute.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = await getDb();

  await db.execute({
    sql: "DELETE FROM projects WHERE id = ?",
    args: [id],
  });

  return c.json({ deleted: true });
});
