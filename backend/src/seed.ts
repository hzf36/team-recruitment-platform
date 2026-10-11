import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const ACCOUNTS = [
  {
    username: "alice",
    password: "password123",
    nickname: "Alice（发起人A）",
    bio: "喜欢带队做实践项目",
    skills: ["Vue", "项目管理"],
    weekly_hours: 12,
  },
  {
    username: "bob",
    password: "password123",
    nickname: "Bob（申请人B）",
    bio: "前端学习者",
    skills: ["HTML", "CSS", "JavaScript"],
    weekly_hours: 10,
  },
  {
    username: "carol",
    password: "password123",
    nickname: "Carol（申请人C）",
    bio: "测试与后端",
    skills: ["Python", "测试"],
    weekly_hours: 8,
  },
  {
    username: "dave",
    password: "password123",
    nickname: "Dave（无关用户D）",
    bio: "路过观察",
    skills: ["文档"],
    weekly_hours: 4,
  },
];

const SEED_TITLES = {
  open: "[SEED] 招募中-筛选样例",
  paused: "[SEED] 暂停招募样例",
  full: "[SEED] 已满员样例",
  race: "[SEED] 单名额竞争样例",
};

async function ensureUserIds() {
  const result = await pool.query(
    "SELECT id, username FROM users WHERE username = ANY($1)",
    [ACCOUNTS.map((a) => a.username)],
  );
  const map = new Map<string, number>();
  for (const row of result.rows) map.set(row.username, row.id);
  for (const a of ACCOUNTS) {
    if (!map.has(a.username)) {
      throw new Error(`Seed user missing: ${a.username}`);
    }
  }
  return map as Map<string, number> & {
    get(name: string): number;
  };
}

async function projectExists(title: string): Promise<boolean> {
  const result = await pool.query("SELECT id FROM projects WHERE title = $1", [
    title,
  ]);
  return Boolean(result.rowCount && result.rowCount > 0);
}

/** Idempotent: insert missing seed users/projects only; never wipe or overwrite. */
export async function runSeed() {
  for (const account of ACCOUNTS) {
    const existing = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [account.username],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      console.log(`Seed user exists: ${account.username}`);
      continue;
    }
    const hash = await bcrypt.hash(account.password, 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, nickname, bio, skills, weekly_hours)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        account.username,
        hash,
        account.nickname,
        account.bio,
        account.skills,
        account.weekly_hours,
      ],
    );
    console.log(`Seeded user: ${account.username}`);
  }

  const users = await ensureUserIds();
  const alice = users.get("alice")!;
  const bob = users.get("bob")!;
  const carol = users.get("carol")!;

  // 1) Open recruiting project for filter demos
  if (!(await projectExists(SEED_TITLES.open))) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const p = await client.query(
        `INSERT INTO projects (owner_id, title, goal, progress, expected_outcome, paused)
         VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id`,
        [
          alice,
          SEED_TITLES.open,
          "示范关键词与角色技能同角色匹配的开放招募项目",
          "需求已整理，等待前端与测试加入",
          "可演示筛选与正常申请",
        ],
      );
      const projectId = p.rows[0].id as number;
      await client.query(
        `INSERT INTO project_roles (project_id, name, skill_requirements, capacity)
         VALUES
         ($1, '前端开发', ARRAY['Vue','JavaScript'], 2),
         ($1, '测试工程师', ARRAY['Python','测试'], 1)`,
        [projectId],
      );
      await client.query(
        `INSERT INTO members (project_id, user_id, role_id, is_owner)
         VALUES ($1, $2, NULL, TRUE)`,
        [projectId, alice],
      );
      await client.query("COMMIT");
      console.log(`Seeded project: ${SEED_TITLES.open}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } else {
    console.log(`Seed project exists: ${SEED_TITLES.open}`);
  }

  // 2) Paused project
  if (!(await projectExists(SEED_TITLES.paused))) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const p = await client.query(
        `INSERT INTO projects (owner_id, title, goal, progress, expected_outcome, paused)
         VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id`,
        [
          alice,
          SEED_TITLES.paused,
          "示范暂停招募：不可新申请，已有 pending 仍可审核",
          "已暂停",
          "恢复后若有名额可继续申请",
        ],
      );
      const projectId = p.rows[0].id as number;
      const role = await client.query(
        `INSERT INTO project_roles (project_id, name, skill_requirements, capacity)
         VALUES ($1, '文档整理', ARRAY['文档'], 2) RETURNING id`,
        [projectId],
      );
      const roleId = role.rows[0].id as number;
      await client.query(
        `INSERT INTO members (project_id, user_id, role_id, is_owner)
         VALUES ($1, $2, NULL, TRUE)`,
        [projectId, alice],
      );
      // One pending application created while seeding (project already paused —
      // insert directly to represent "existing pending before/during pause")
      const dave = users.get("dave")!;
      const daveProfile = await client.query(
        "SELECT nickname, bio, skills, weekly_hours FROM users WHERE id = $1",
        [dave],
      );
      const dp = daveProfile.rows[0];
      await client.query(
        `INSERT INTO applications (
           project_id, role_id, applicant_id, reason, contribution, status,
           snapshot_nickname, snapshot_bio, snapshot_skills, snapshot_weekly_hours
         ) VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9)`,
        [
          projectId,
          roleId,
          dave,
          "暂停前已提交的申请，用于验证仍可审核",
          "整理 README",
          dp.nickname,
          dp.bio,
          dp.skills,
          dp.weekly_hours,
        ],
      );
      await client.query("COMMIT");
      console.log(`Seeded project: ${SEED_TITLES.paused}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } else {
    console.log(`Seed project exists: ${SEED_TITLES.paused}`);
  }

  // 3) Full project: capacity 1, bob already joined (owner does not consume quota)
  if (!(await projectExists(SEED_TITLES.full))) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const p = await client.query(
        `INSERT INTO projects (owner_id, title, goal, progress, expected_outcome, paused)
         VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id`,
        [
          alice,
          SEED_TITLES.full,
          "示范招募已满：不可再申请，不可再接受",
          "成员已齐",
          "满员状态与真实剩余名额一致",
        ],
      );
      const projectId = p.rows[0].id as number;
      const role = await client.query(
        `INSERT INTO project_roles (project_id, name, skill_requirements, capacity)
         VALUES ($1, '后端开发', ARRAY['Node','PostgreSQL'], 1) RETURNING id`,
        [projectId],
      );
      const roleId = role.rows[0].id as number;
      await client.query(
        `INSERT INTO members (project_id, user_id, role_id, is_owner)
         VALUES ($1, $2, NULL, TRUE)`,
        [projectId, alice],
      );
      await client.query(
        `INSERT INTO members (project_id, user_id, role_id, is_owner)
         VALUES ($1, $2, $3, FALSE)`,
        [projectId, bob, roleId],
      );
      // Keep an extra pending from carol to show pending is NOT auto-accepted when full
      const carolProfile = await client.query(
        "SELECT nickname, bio, skills, weekly_hours FROM users WHERE id = $1",
        [carol],
      );
      const cp = carolProfile.rows[0];
      await client.query(
        `INSERT INTO applications (
           project_id, role_id, applicant_id, reason, contribution, status,
           snapshot_nickname, snapshot_bio, snapshot_skills, snapshot_weekly_hours
         ) VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9)`,
        [
          projectId,
          roleId,
          carol,
          "满员后仍保留的待审核申请，不得自动通过",
          "可做接口测试",
          cp.nickname,
          cp.bio,
          cp.skills,
          cp.weekly_hours,
        ],
      );
      await client.query("COMMIT");
      console.log(`Seeded project: ${SEED_TITLES.full}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } else {
    console.log(`Seed project exists: ${SEED_TITLES.full}`);
  }

  // 4) Race fixture: remaining=1, two pending from bob & carol
  if (!(await projectExists(SEED_TITLES.race))) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const p = await client.query(
        `INSERT INTO projects (owner_id, title, goal, progress, expected_outcome, paused)
         VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id`,
        [
          alice,
          SEED_TITLES.race,
          "示范最后 1 个名额被两名申请人竞争",
          "尚未录取招募成员",
          "并发接受最多一人加入",
        ],
      );
      const projectId = p.rows[0].id as number;
      const role = await client.query(
        `INSERT INTO project_roles (project_id, name, skill_requirements, capacity)
         VALUES ($1, '前端开发', ARRAY['Web','JavaScript'], 1) RETURNING id`,
        [projectId],
      );
      const roleId = role.rows[0].id as number;
      await client.query(
        `INSERT INTO members (project_id, user_id, role_id, is_owner)
         VALUES ($1, $2, NULL, TRUE)`,
        [projectId, alice],
      );
      for (const uid of [bob, carol]) {
        const profile = await client.query(
          "SELECT nickname, bio, skills, weekly_hours FROM users WHERE id = $1",
          [uid],
        );
        const pr = profile.rows[0];
        await client.query(
          `INSERT INTO applications (
             project_id, role_id, applicant_id, reason, contribution, status,
             snapshot_nickname, snapshot_bio, snapshot_skills, snapshot_weekly_hours
           ) VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9)`,
          [
            projectId,
            roleId,
            uid,
            `竞争名额申请（user ${uid}）`,
            "可立即投入页面开发",
            pr.nickname,
            pr.bio,
            pr.skills,
            pr.weekly_hours,
          ],
        );
      }
      await client.query("COMMIT");
      console.log(`Seeded project: ${SEED_TITLES.race}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } else {
    console.log(`Seed project exists: ${SEED_TITLES.race}`);
  }
}

if (
  process.argv[1]?.endsWith("seed.ts") ||
  process.argv[1]?.endsWith("seed.js")
) {
  runSeed()
    .then(() => pool.end())
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
