import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  const dir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const file of files) {
    const id = file;
    const exists = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE id = $1",
      [id],
    );
    if (exists.rowCount && exists.rowCount > 0) continue;

    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [id]);
      await client.query("COMMIT");
      console.log(`Applied migration ${id}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

const isCli = process.argv[1]?.includes("migrate");
if (isCli) {
  runMigrations()
    .then(() => pool.end())
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
