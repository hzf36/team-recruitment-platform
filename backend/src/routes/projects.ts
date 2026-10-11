import { Router } from "express";
import { z } from "zod";
import { pool, withTransaction } from "../db.js";
import { requireAuth } from "../auth.js";
import { loadProjectDetail } from "../services/projectView.js";

export const projectsRouter = Router();

/** Normalize skill/tag tokens: trim + case-fold for set membership (not substring). */
function normalizeTag(s: string): string {
  return s.trim().toLowerCase();
}

projectsRouter.get("/", requireAuth, async (req, res) => {
  const keyword = String(req.query.keyword ?? "").trim();
  const role = String(req.query.role ?? "").trim();
  const skillsRaw = String(req.query.skills ?? "").trim();
  const skills = skillsRaw
    ? skillsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const result = await pool.query(
    `SELECT p.id, p.title, p.goal, p.progress, p.paused, p.created_at,
            u.nickname AS owner_nickname,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', r.id,
                  'name', r.name,
                  'skillRequirements', r.skill_requirements,
                  'capacity', r.capacity,
                  'filled', (
                    SELECT COUNT(*)::int FROM members m
                    WHERE m.role_id = r.id AND m.is_owner = FALSE
                  )
                )
                ORDER BY r.id
              ) FILTER (WHERE r.id IS NOT NULL),
              '[]'
            ) AS roles
     FROM projects p
     JOIN users u ON u.id = p.owner_id
     LEFT JOIN project_roles r ON r.project_id = p.id
     GROUP BY p.id, u.nickname
     ORDER BY p.created_at DESC`,
  );

  let items = result.rows.map((p) => {
    const roles = (p.roles as Array<Record<string, unknown>>).map((r) => {
      const filled = Number(r.filled);
      const capacity = Number(r.capacity);
      return {
        id: r.id,
        name: String(r.name),
        skillRequirements: r.skillRequirements as string[],
        capacity,
        filled,
        remaining: Math.max(0, capacity - filled),
      };
    });
    const allFull = roles.length > 0 && roles.every((r) => r.remaining === 0);
    return {
      id: p.id,
      title: p.title,
      goal: p.goal,
      progress: p.progress,
      paused: p.paused,
      ownerNickname: p.owner_nickname,
      roles,
      recruitStatus: p.paused ? "paused" : allFull ? "full" : "open",
      createdAt: p.created_at,
    };
  });

  if (keyword) {
    const kw = keyword.toLowerCase();
    items = items.filter(
      (p) =>
        p.title.toLowerCase().includes(kw) ||
        p.goal.toLowerCase().includes(kw) ||
        String(p.progress).toLowerCase().includes(kw),
    );
  }

  if (role || skills.length > 0) {
    items = items.filter((p) =>
      p.roles.some((r) => {
        if (role && !r.name.toLowerCase().includes(role.toLowerCase())) {
          return false;
        }
        if (skills.length > 0) {
          // Set containment: every filter skill must equal a role skill after normalize.
          // "Java" must NOT match "JavaScript".
          const roleSkillSet = new Set(
            (r.skillRequirements ?? []).map((s) => normalizeTag(String(s))),
          );
          const ok = skills.every((s) => roleSkillSet.has(normalizeTag(s)));
          if (!ok) return false;
        }
        return true;
      }),
    );
  }

  return res.json({ items });
});

projectsRouter.get("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "无效项目 ID" });
  }
  const detail = await loadProjectDetail(pool, id);
  if (!detail) return res.status(404).json({ error: "项目不存在" });
  return res.json(detail);
});

projectsRouter.post("/", requireAuth, async (req, res) => {
  const nonEmpty = (max: number) => z.string().trim().min(1).max(max);
  const parsed = z
    .object({
      title: nonEmpty(120),
      goal: nonEmpty(4000),
      progress: nonEmpty(4000),
      expectedOutcome: nonEmpty(4000),
      roles: z
        .array(
          z.object({
            name: nonEmpty(80),
            // At least one non-blank skill tag after trim (reject [], missing, ["  "])
            skillRequirements: z
              .array(z.string().trim().min(1).max(40))
              .min(1)
              .max(20),
            capacity: z.number().int().min(1).max(100),
          }),
        )
        .min(1)
        .max(20),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "请填写完整项目与至少一个招募角色，且每个角色须明确非空技能要求",
    });
  }

  const data = parsed.data;
  const projectId = await withTransaction(async (client) => {
    const p = await client.query(
      `INSERT INTO projects (owner_id, title, goal, progress, expected_outcome)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        req.user!.id,
        data.title,
        data.goal,
        data.progress,
        data.expectedOutcome,
      ],
    );
    const id = p.rows[0].id as number;
    for (const role of data.roles) {
      await client.query(
        `INSERT INTO project_roles (project_id, name, skill_requirements, capacity)
         VALUES ($1, $2, $3, $4)`,
        [id, role.name, role.skillRequirements, role.capacity],
      );
    }
    // Owner shown as member, does not occupy recruit quota (is_owner=true, role_id null)
    await client.query(
      `INSERT INTO members (project_id, user_id, role_id, is_owner)
       VALUES ($1, $2, NULL, TRUE)`,
      [id, req.user!.id],
    );
    return id;
  });

  const detail = await loadProjectDetail(pool, projectId);
  return res.status(201).json(detail);
});

projectsRouter.post("/:id/pause", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const result = await pool.query(
    "SELECT owner_id FROM projects WHERE id = $1",
    [id],
  );
  const project = result.rows[0];
  if (!project) return res.status(404).json({ error: "项目不存在" });
  if (project.owner_id !== req.user!.id) {
    return res.status(403).json({ error: "仅发起人可暂停招募" });
  }
  await pool.query(
    "UPDATE projects SET paused = TRUE, updated_at = NOW() WHERE id = $1",
    [id],
  );
  return res.json(await loadProjectDetail(pool, id));
});

projectsRouter.post("/:id/resume", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const result = await pool.query(
    "SELECT owner_id FROM projects WHERE id = $1",
    [id],
  );
  const project = result.rows[0];
  if (!project) return res.status(404).json({ error: "项目不存在" });
  if (project.owner_id !== req.user!.id) {
    return res.status(403).json({ error: "仅发起人可恢复招募" });
  }
  await pool.query(
    "UPDATE projects SET paused = FALSE, updated_at = NOW() WHERE id = $1",
    [id],
  );
  return res.json(await loadProjectDetail(pool, id));
});
