import type { DbClient } from "../db.js";

export async function roleFilledCount(
  client: DbClient,
  roleId: number,
): Promise<number> {
  const result = await client.query(
    `SELECT COUNT(*)::int AS c
     FROM members
     WHERE role_id = $1 AND is_owner = FALSE`,
    [roleId],
  );
  return result.rows[0].c as number;
}

export async function loadProjectDetail(client: DbClient, projectId: number) {
  const projectRes = await client.query(
    `SELECT p.*, u.nickname AS owner_nickname, u.bio AS owner_bio,
            u.skills AS owner_skills, u.weekly_hours AS owner_weekly_hours,
            u.username AS owner_username
     FROM projects p
     JOIN users u ON u.id = p.owner_id
     WHERE p.id = $1`,
    [projectId],
  );
  const project = projectRes.rows[0];
  if (!project) return null;

  const rolesRes = await client.query(
    `SELECT r.*,
       (SELECT COUNT(*)::int FROM members m
         WHERE m.role_id = r.id AND m.is_owner = FALSE) AS filled
     FROM project_roles r
     WHERE r.project_id = $1
     ORDER BY r.id`,
    [projectId],
  );

  const membersRes = await client.query(
    `SELECT m.id, m.user_id, m.role_id, m.is_owner, m.joined_at,
            u.nickname, u.username, r.name AS role_name
     FROM members m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN project_roles r ON r.id = m.role_id
     WHERE m.project_id = $1
     ORDER BY m.is_owner DESC, m.joined_at`,
    [projectId],
  );

  const roles = rolesRes.rows.map((r) => {
    const filled = r.filled as number;
    const remaining = Math.max(0, r.capacity - filled);
    return {
      id: r.id,
      name: r.name,
      skillRequirements: r.skill_requirements,
      capacity: r.capacity,
      filled,
      remaining,
    };
  });

  const allFull =
    roles.length > 0 && roles.every((r) => r.remaining === 0);

  return {
    id: project.id,
    title: project.title,
    goal: project.goal,
    progress: project.progress,
    expectedOutcome: project.expected_outcome,
    paused: project.paused,
    ownerId: project.owner_id,
    owner: {
      id: project.owner_id,
      username: project.owner_username,
      nickname: project.owner_nickname,
      bio: project.owner_bio,
      skills: project.owner_skills,
      weeklyHours: project.owner_weekly_hours,
    },
    roles,
    members: membersRes.rows.map((m) => ({
      id: m.id,
      userId: m.user_id,
      username: m.username,
      nickname: m.nickname,
      roleId: m.role_id,
      roleName: m.is_owner ? "发起人" : m.role_name,
      isOwner: m.is_owner,
      joinedAt: m.joined_at,
    })),
    recruitStatus: project.paused
      ? "paused"
      : allFull
        ? "full"
        : "open",
    createdAt: project.created_at,
  };
}

export function mapApplicationRow(
  row: Record<string, unknown>,
  includeBody: boolean,
) {
  const base = {
    id: row.id,
    projectId: row.project_id,
    projectTitle: row.project_title,
    roleId: row.role_id,
    roleName: row.role_name,
    applicantId: row.applicant_id,
    applicantUsername: row.applicant_username,
    status: row.status,
    rejectReason: row.reject_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    snapshot: {
      nickname: row.snapshot_nickname,
      bio: row.snapshot_bio,
      skills: row.snapshot_skills,
      weeklyHours: row.snapshot_weekly_hours,
    },
  };
  if (!includeBody) {
    return { ...base, reason: null, contribution: null };
  }
  return {
    ...base,
    reason: row.reason,
    contribution: row.contribution,
  };
}
