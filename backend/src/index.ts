import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";
import { runMigrations } from "./migrate.js";
import { runSeed } from "./seed.js";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";
import { projectsRouter } from "./routes/projects.js";
import { applicationsRouter } from "./routes/applications.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8080);

async function waitForDb(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch {
      console.log(`Waiting for database... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("Database not ready");
}

async function main() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  await waitForDb();
  await runMigrations();
  await runSeed();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/applications", applicationsRouter);

  const staticDir = process.env.STATIC_DIR
    ? path.resolve(process.env.STATIC_DIR)
    : path.resolve(__dirname, "../../frontend/dist");

  app.use(express.static(staticDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(staticDir, "index.html"), (err) => {
      if (err) next();
    });
  });

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(err);
      res.status(500).json({ error: "服务器内部错误" });
    },
  );

  app.listen(port, () => {
    console.log(`App listening on :${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
