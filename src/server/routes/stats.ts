import { Hono } from "hono";
import { getDb } from "../../db/client.ts";

export const statsRoute = new Hono();

statsRoute.get("/", async (c) => {
  const db = await getDb();

  // Total count
  const totalResult = await db.execute("SELECT COUNT(*) as count FROM tasks");
  const total = Number(totalResult.rows[0].count);

  // By status
  const statusResult = await db.execute(`
    SELECT status, COUNT(*) as count
    FROM tasks
    GROUP BY status
  `);
  const by_status: Record<string, number> = {
    todo: 0,
    "in-progress": 0,
    done: 0,
  };
  for (const row of statusResult.rows) {
    const status = row.status as string;
    if (status in by_status) {
      by_status[status] = Number(row.count);
    }
  }

  // By priority
  const priorityResult = await db.execute(`
    SELECT priority, COUNT(*) as count
    FROM tasks
    GROUP BY priority
  `);
  const by_priority = { normal: 0, high: 0, urgent: 0 };
  for (const row of priorityResult.rows) {
    const p = Number(row.priority);
    if (p === 0) by_priority.normal = Number(row.count);
    else if (p === 1) by_priority.high = Number(row.count);
    else if (p === 2) by_priority.urgent = Number(row.count);
  }

  // By project
  const projectResult = await db.execute(`
    SELECT p.id as project_id, p.name as project_name, COUNT(t.id) as count
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    GROUP BY p.id, p.name
  `);
  const by_project = projectResult.rows.map((row) => ({
    project_id: row.project_id as number | null,
    project_name: row.project_name as string | null,
    count: Number(row.count),
  }));

  // Overdue count
  const overdueResult = await db.execute(`
    SELECT COUNT(*) as count
    FROM tasks
    WHERE due_date < date('now') AND status != 'done'
  `);
  const overdue = Number(overdueResult.rows[0].count);

  return c.json({
    total,
    by_status,
    by_priority,
    by_project,
    overdue,
  });
});
