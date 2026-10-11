import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type AuthUser = { id: number; username: string };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return secret;
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, username: user.username },
    jwtSecret(),
    { expiresIn: "7d" },
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "未登录" });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, jwtSecret());
    if (typeof payload === "string" || payload.sub == null) {
      return res.status(401).json({ error: "登录已失效，请重新登录" });
    }
    const username =
      typeof payload.username === "string" ? payload.username : "";
    req.user = { id: Number(payload.sub), username };
    next();
  } catch {
    return res.status(401).json({ error: "登录已失效，请重新登录" });
  }
}

export class HttpError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.error ?? "error"));
    this.status = status;
    this.body = body;
  }
}
