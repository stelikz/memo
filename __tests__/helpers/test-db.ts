import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import * as schema from "../../db/schema";

export function createTestDb() {
  const sqlite = new Database(":memory:");

  // Apply Drizzle migrations so the test schema stays in sync with the real one
  const migrationDir = path.join(__dirname, "..", "..", "drizzle");
  const journalPath = path.join(migrationDir, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
  const migrationFiles: string[] = journal.entries.map(
    (e: { tag: string }) => e.tag
  );

  for (const tag of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationDir, `${tag}.sql`), "utf-8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      sqlite.exec(stmt);
    }
  }

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
