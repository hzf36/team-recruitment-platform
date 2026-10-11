import { Router } from "express";
import { z } from "zod";
import { pool, withTransaction } from "../db.js";
import { HttpError, requireAuth } from "../auth.js";
import {
  loadProjectDetail,
  mapApplicationRow,
  roleFilledCount,
} from "../services/projectView.js";

export const applicationsRouter = Router();

/**
 * Lock order (must stay consistent everywhere):
 * 1) pg_advisory_xact_lock(projectId, userId) — coordinates apply vs accept for same pair
 * 2) project_roles FOR UPDATE
 * 3) applications FOR UPDATE (when updating an existing row)
 */
async function lockProjectUser(
  client: { query: Function },
  projectId: number,
  userId: number,
) {
  await client.query("SELECT pg_advisory_xact_lock($1, $2)", [
    projectId,
    userId,
  ]);
}

applicationsRouter.post("/", requireAuth, async (req, res) => {
  const parsed = z
    .object({
      projectId: z.number().int(),
      roleId: z.number().int(),
      reason: z.string().trim().min(1).max(4000),
      contribution: z.string().trim().max(4000).optional().default(""),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "请填写完整申请信息" });
  }
  const { projectId, roleId, reason, contribution } = parsed.data;
  const applicantId = req.user!.id;

  try {
    const app = await withTransaction(async (client) => {
      await lockProjectUser(client, projectId, applicantId);

      const projectRes = await client.query(
        `SELECT id, owner_id, paused FROM projects WHERE id = $1 FOR UPDATE`,
        [projectId],
      );
      const project = projectRes.rows[0];
      if (!project) throw new HttpError(404, { error: "项目不存在" });
      if (project.owner_id === applicantId) {
        throw new HttpError(400, { error: "不能申请自己发起的项目" });
      }
      if (project.paused) {
        throw new HttpError(400, { error: "项目已暂停招募，暂不可新申请" });
      }

      const roleRes = await client.query(
        `SELECT id, project_id, capacity FROM project_roles
         WHERE id = $1 AND project_id = $2 FOR UPDATE`,
        [roleId, projectId],
      );
      const role = roleRes.rows[0];
      if (!role) throw new HttpError(400, { error: "招募角色不存在" });

      const memberRes = await client.query(
        `SELECT id FROM members WHERE project_id = $1 AND user_id = $2`,
        [projectId, applicantId],
      );
      if (memberRes.rowCount && memberRes.rowCount > 0) {
        throw new HttpError(400, {
          error: "你已是该项目成员，不能再提交待审核申请",
        });
      }

      const pendingRes = await client.query(
        `SELECT id FROM applications
         WHERE project_id = $1 AND applicant_id = $2 AND status = 'pending'`,
        [projectId, applicantId],
      );
      if (pendingRes.rowCount && pendingRes.rowCount > 0) {
        throw new HttpError(400, {
          error: "该项目已有待审核申请，请先等待审核或撤回后再申请",
        });
      }

      const filled = await roleFilledCount(client, roleId);
      if (filled >= role.capacity) {
        throw new HttpError(400, { error: "该角色名额已满，无法申请" });
      }

      const profileRes = await client.query(
        `SELECT nickname, bio, skills, weekly_hours FROM users WHERE id = $1`,
        [applicantId],
      );
      const profile = profileRes.rows[0];

      const inserted = await client.query(
        `INSERT INTO applications (
           project_id, role_id, applicant_id, reason, contribution, status,
           snapshot_nickname, snapshot_bio, snapshot_skills, snapshot_weekly_hours
         ) VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9)
         RETURNING *`,
        [
          projectId,
          roleId,
          applicantId,
          reason,
          contribution,
          profile.nickname,
          profile.bio,
          profile.skills,
          profile.weekly_hours,
        ],
      );
      return inserted.rows[0];
    });

    return res.status(201).json({
      id: app.id,
      projectId: app.project_id,
      roleId: app.role_id,
      status: app.status,
      reason: app.reason,
      contribution: app.contribution,
      snapshot: {
        nickname: app.snapshot_nickname,
        bio: app.snapshot_bio,
        skills: app.snapshot_skills,
        weeklyHours: app.snapshot_weekly_hours,
      },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json(err.body);
    }
    if ((err as { code?: string }).code === "23505") {
      return res.status(400).json({
        error: "该项目已有待审核申请，请先等待审核或撤回后再申请",
      });
    }
    throw err;
  }
});

applicationsRouter.get("/mine", requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT a.*, p.title AS project_title, r.name AS role_name,
            u.username AS applicant_username
     FROM applications a
     JOIN projects p ON p.id = a.project_id
     JOIN project_roles r ON r.id = a.role_id
     JOIN users u ON u.id = a.applicant_id
     WHERE a.applicant_id = $1
     ORDER BY a.created_at DESC`,
    [req.user!.id],
  );
  return res.json({
    items: result.rows.map((row) => mapApplicationRow(row, true)),
  });
});

applicationsRouter.get(
  "/project/:projectId",
  requireAuth,
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const projectRes = await pool.query(
      "SELECT owner_id FROM projects WHERE id = $1",
      [projectId],
    );
    const project = projectRes.rows[0];
    if (!project) return res.status(404).json({ error: "项目不存在" });
    if (project.owner_id !== req.user!.id) {
      return res.status(403).json({ error: "仅发起人可查看本项目全部申请" });
    }
    const result = await pool.query(
      `SELECT a.*, p.title AS project_title, r.name AS role_name,
              u.username AS applicant_username
       FROM applications a
       JOIN projects p ON p.id = a.project_id
       JOIN project_roles r ON r.id = a.role_id
       JOIN users u ON u.id = a.applicant_id
       WHERE a.project_id = $1
       ORDER BY a.created_at DESC`,
      [projectId],
    );
    return res.json({
      items: result.rows.map((row) => mapApplicationRow(row, true)),
    });
  },
);

applicationsRouter.get("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const result = await pool.query(
    `SELECT a.*, p.title AS project_title, p.owner_id, r.name AS role_name,
            u.username AS applicant_username
     FROM applications a
     JOIN projects p ON p.id = a.project_id
     JOIN project_roles r ON r.id = a.role_id
     JOIN users u ON u.id = a.applicant_id
     WHERE a.id = $1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "申请不存在" });
  const canBody =
    req.user!.id === row.owner_id || req.user!.id === row.applicant_id;
  if (!canBody) {
    return res.status(403).json({ error: "无权查看该申请正文" });
  }
  return res.json(mapApplicationRow(row, true));
});

applicationsRouter.post("/:id/withdraw", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const updated = await withTransaction(async (client) => {
      const peek = await client.query(
        `SELECT project_id, applicant_id FROM applications WHERE id = $1`,
        [id],
      );
      const head = peek.rows[0];
      if (!head) throw new HttpError(404, { error: "申请不存在" });
      if (head.applicant_id !== req.user!.id) {
        throw new HttpError(403, { error: "只能撤回自己的申请" });
      }
      await lockProjectUser(client, head.project_id, head.applicant_id);
      const appRes = await client.query(
        `SELECT * FROM applications WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const app = appRes.rows[0];
      if (!app) throw new HttpError(404, { error: "申请不存在" });
      if (app.status !== "pending") {
        throw new HttpError(400, {
          error: "申请状态已变化，无法撤回",
          status: app.status,
        });
      }
      const result = await client.query(
        `UPDATE applications SET status = 'withdrawn', updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id],
      );
      return result.rows[0];
    });
    return res.json({ id: updated.id, status: updated.status });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json(err.body);
    }
    throw err;
  }
});

applicationsRouter.post("/:id/reject", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = z
    .object({ reason: z.string().trim().min(1).max(500) })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "拒绝时请填写简短原因" });
  }
  try {
    const updated = await withTransaction(async (client) => {
      const peek = await client.query(
        `SELECT a.project_id, a.applicant_id, p.owner_id
         FROM applications a
         JOIN projects p ON p.id = a.project_id
         WHERE a.id = $1`,
        [id],
      );
      const head = peek.rows[0];
      if (!head) throw new HttpError(404, { error: "申请不存在" });
      if (head.owner_id !== req.user!.id) {
        throw new HttpError(403, { error: "仅发起人可审核该申请" });
      }
      await lockProjectUser(client, head.project_id, head.applicant_id);
      const appRes = await client.query(
        `SELECT * FROM applications WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const app = appRes.rows[0];
      if (!app) throw new HttpError(404, { error: "申请不存在" });
      if (app.status !== "pending") {
        throw new HttpError(400, {
          error: "申请状态已变化，无法拒绝",
          status: app.status,
        });
      }
      const result = await client.query(
        `UPDATE applications
         SET status = 'rejected', reject_reason = $2, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id, parsed.data.reason],
      );
      return result.rows[0];
    });
    return res.json({
      id: updated.id,
      status: updated.status,
      rejectReason: updated.reject_reason,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json(err.body);
    }
    throw err;
  }
});

applicationsRouter.post("/:id/accept", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const outcome = await withTransaction(async (client) => {
      // Peek keys without row locks, then acquire locks in fixed order:
      // advisory(project,user) → role FOR UPDATE → application FOR UPDATE
      const peek = await client.query(
        `SELECT a.project_id, a.applicant_id, a.role_id, p.owner_id
         FROM applications a
         JOIN projects p ON p.id = a.project_id
         WHERE a.id = $1`,
        [id],
      );
      const head = peek.rows[0];
      if (!head) throw new HttpError(404, { error: "申请不存在" });
      if (head.owner_id !== req.user!.id) {
        throw new HttpError(403, { error: "仅发起人可审核该申请" });
      }

      await lockProjectUser(client, head.project_id, head.applicant_id);

      const roleRes = await client.query(
        `SELECT id, capacity FROM project_roles
         WHERE id = $1 AND project_id = $2 FOR UPDATE`,
        [head.role_id, head.project_id],
      );
      const role = roleRes.rows[0];
      if (!role) throw new HttpError(400, { error: "招募角色不存在" });

      const appRes = await client.query(
        `SELECT * FROM applications WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const app = appRes.rows[0];
      if (!app) throw new HttpError(404, { error: "申请不存在" });

      // Idempotent: already accepted → already processed, no double seat
      if (app.status === "accepted") {
        const member = await client.query(
          `SELECT id FROM members
           WHERE project_id = $1 AND user_id = $2`,
          [app.project_id, app.applicant_id],
        );
        return {
          kind: "already" as const,
          applicationId: app.id,
          memberId: member.rows[0]?.id ?? null,
        };
      }
      if (app.status !== "pending") {
        throw new HttpError(400, {
          error: "申请状态已变化，无法接受",
          status: app.status,
        });
      }

      const existingMember = await client.query(
        `SELECT id FROM members WHERE project_id = $1 AND user_id = $2`,
        [app.project_id, app.applicant_id],
      );
      if (existingMember.rowCount && existingMember.rowCount > 0) {
        throw new HttpError(400, {
          error: "该用户已是项目成员，不能重复加入",
        });
      }

      const filled = await roleFilledCount(client, app.role_id);
      if (filled >= role.capacity) {
        throw new HttpError(409, {
          error: "该角色名额已满",
          remaining: 0,
          filled,
          capacity: role.capacity,
        });
      }

      await client.query(
        `UPDATE applications
         SET status = 'accepted', updated_at = NOW()
         WHERE id = $1`,
        [id],
      );
      const memberIns = await client.query(
        `INSERT INTO members (project_id, user_id, role_id, is_owner)
         VALUES ($1, $2, $3, FALSE)
         RETURNING id`,
        [app.project_id, app.applicant_id, app.role_id],
      );

      return {
        kind: "accepted" as const,
        applicationId: app.id,
        memberId: memberIns.rows[0].id as number,
        projectId: app.project_id as number,
      };
    });

    if (outcome.kind === "already") {
      return res.json({
        handled: true,
        message: "已处理",
        applicationId: outcome.applicationId,
        memberId: outcome.memberId,
        status: "accepted",
      });
    }

    const detail = await loadProjectDetail(pool, outcome.projectId);
    return res.json({
      handled: false,
      message: "已接受",
      applicationId: outcome.applicationId,
      memberId: outcome.memberId,
      status: "accepted",
      project: detail,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json(err.body);
    }
    if ((err as { code?: string }).code === "23505") {
      return res.status(409).json({ error: "成员记录已存在，未重复占位" });
    }
    throw err;
  }
});
