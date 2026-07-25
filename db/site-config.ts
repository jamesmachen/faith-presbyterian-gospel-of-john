import { env } from "cloudflare:workers";
import { DEFAULT_STUDY_PASSAGES, type StudyPassageConfig } from "@/app/site-config";

function database() {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("The site configuration database is unavailable.");
  return db;
}

async function ensureStudyPassageStore() {
  const db = database();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS study_passages (
      id TEXT PRIMARY KEY NOT NULL,
      week_label TEXT NOT NULL,
      scripture_label TEXT NOT NULL,
      description_label TEXT NOT NULL,
      display_order INTEGER NOT NULL
    )
  `).run();
  const count = await db.prepare("SELECT COUNT(*) AS count FROM study_passages").first<{ count: number }>();
  if (!count?.count) {
    await db.batch(DEFAULT_STUDY_PASSAGES.map((passage) => db.prepare(`
      INSERT OR IGNORE INTO study_passages
        (id, week_label, scripture_label, description_label, display_order)
      VALUES (?, ?, ?, ?, ?)
    `).bind(passage.id, passage.weekLabel, passage.scriptureLabel, passage.descriptionLabel, passage.displayOrder)));
  }
  return db;
}

export async function listStudyPassages(): Promise<StudyPassageConfig[]> {
  const db = await ensureStudyPassageStore();
  const result = await db.prepare(`
    SELECT
      id,
      week_label AS weekLabel,
      scripture_label AS scriptureLabel,
      description_label AS descriptionLabel,
      display_order AS displayOrder
    FROM study_passages
    ORDER BY display_order, id
  `).all<StudyPassageConfig>();
  return result.results;
}

export async function saveStudyPassages(passages: StudyPassageConfig[]) {
  const db = await ensureStudyPassageStore();
  await db.batch(passages.map((passage) => db.prepare(`
    INSERT INTO study_passages
      (id, week_label, scripture_label, description_label, display_order)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      week_label = excluded.week_label,
      scripture_label = excluded.scripture_label,
      description_label = excluded.description_label,
      display_order = excluded.display_order
  `).bind(passage.id, passage.weekLabel, passage.scriptureLabel, passage.descriptionLabel, passage.displayOrder)));
}
