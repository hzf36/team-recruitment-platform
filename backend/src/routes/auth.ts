import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, signToken } from "../auth.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const parsed = z
    .object({
      username: z.string().min(1),
      password: z.string().min(1),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "请输入用户名和密码" });
  }
  const { username, password } = parsed.data;
  const result = await pool.query(
    `SELECT id, username, password_hash, nickname, bio, skills, weekly_hours
     FROM users WHERE username = $1`,
    [username],
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "用户名或密码错误" });
  }
  const token = signToken({ id: user.id, username: user.username });
  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      bio: user.bio,
      skills: user.skills,
      weeklyHours: user.weekly_hours,
    },
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  // Test-only fault injection for identity-init probes (unset in normal deploy).
  const force = process.env.AUTH_ME_FORCE_ERROR?.trim();
  if (force) {
    const status = Number(force);
    if (Number.isInteger(status) && status >= 400 && status < 600 && status !== 401) {
      return res.status(status).json({
        error: "身份服务暂时不可用（测试注入）",
      });
    }
  }

  const result = await pool.query(
    `SELECT id, username, nickname, bio, skills, weekly_hours
     FROM users WHERE id = $1`,
    [req.user!.id],
  );
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: "用户不存在" });
  return res.json({
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    bio: user.bio,
    skills: user.skills,
    weeklyHours: user.weekly_hours,
  });
});
