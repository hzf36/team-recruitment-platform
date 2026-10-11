import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../auth.js";

export const profileRouter = Router();

profileRouter.put("/me", requireAuth, async (req, res) => {
  const parsed = z
    .object({
      nickname: z.string().trim().min(1).max(80),
      bio: z.string().max(2000).optional().default(""),
      skills: z.array(z.string().trim().min(1).max(40)).max(30),
      weeklyHours: z.number().int().min(0).max(168),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "资料格式不正确" });
  }
  const { nickname, bio, skills, weeklyHours } = parsed.data;
  const result = await pool.query(
    `UPDATE users
     SET nickname = $1, bio = $2, skills = $3, weekly_hours = $4, updated_at = NOW()
     WHERE id = $5
     RETURNING id, username, nickname, bio, skills, weekly_hours`,
    [nickname, bio, skills, weeklyHours, req.user!.id],
  );
  const user = result.rows[0];
  return res.json({
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    bio: user.bio,
    skills: user.skills,
    weeklyHours: user.weekly_hours,
  });
});
