import { database } from "./postgres";
import { DEFAULT_STUDY_PASSAGES, type StudyPassageConfig } from "@/app/site-config";

async function ensureStudyPassageStore() {
  const sql = database();
  await sql`
    CREATE TABLE IF NOT EXISTS study_passages (
      id TEXT PRIMARY KEY NOT NULL,
      week_label TEXT NOT NULL,
      scripture_label TEXT NOT NULL,
      description_label TEXT NOT NULL,
      display_order INTEGER NOT NULL
    )
  `;
  const [count] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM study_passages
  `;
  if (!count?.count) {
    for (const passage of DEFAULT_STUDY_PASSAGES) {
      await sql`
      INSERT INTO study_passages
        (id, week_label, scripture_label, description_label, display_order)
      VALUES (${passage.id}, ${passage.weekLabel}, ${passage.scriptureLabel}, ${passage.descriptionLabel}, ${passage.displayOrder})
      ON CONFLICT (id) DO NOTHING
      `;
    }
  }
  return sql;
}

export async function listStudyPassages(): Promise<StudyPassageConfig[]> {
  const sql = await ensureStudyPassageStore();
  return sql<StudyPassageConfig[]>`
    SELECT
      id,
      week_label AS "weekLabel",
      scripture_label AS "scriptureLabel",
      description_label AS "descriptionLabel",
      display_order AS "displayOrder"
    FROM study_passages
    ORDER BY display_order, id
  `;
}

export async function saveStudyPassages(passages: StudyPassageConfig[]) {
  const sql = await ensureStudyPassageStore();
  await sql.begin(async (transaction) => {
    for (const passage of passages) {
      await transaction`
    INSERT INTO study_passages
      (id, week_label, scripture_label, description_label, display_order)
    VALUES (${passage.id}, ${passage.weekLabel}, ${passage.scriptureLabel}, ${passage.descriptionLabel}, ${passage.displayOrder})
    ON CONFLICT(id) DO UPDATE SET
      week_label = excluded.week_label,
      scripture_label = excluded.scripture_label,
      description_label = excluded.description_label,
      display_order = excluded.display_order
      `;
    }
  });
}
