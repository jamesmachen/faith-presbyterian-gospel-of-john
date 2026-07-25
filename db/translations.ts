import { env } from "cloudflare:workers";

export type BibleTranslation = {
  id: string;
  name: string;
  abbreviation: string;
  url: string;
  iconKey: string | null;
  createdAt: string;
  createdBy: string;
};

function database() {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("The Bible translation database is unavailable.");
  return db;
}

async function ensureTranslationStore() {
  const db = database();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS bible_translations (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      abbreviation TEXT NOT NULL,
      url TEXT NOT NULL,
      icon_key TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT NOT NULL
    )
  `).run();
  await db.prepare(`
    INSERT OR IGNORE INTO bible_translations (id, name, abbreviation, url, created_by)
    VALUES ('default-esv', 'English Standard Version', 'ESV', 'https://www.esv.org/John+1/', 'initial site setup')
  `).run();
  return db;
}

export async function listBibleTranslations(): Promise<BibleTranslation[]> {
  const db = await ensureTranslationStore();
  const result = await db.prepare(`
    SELECT id, name, abbreviation, url, icon_key AS iconKey,
      created_at AS createdAt, created_by AS createdBy
    FROM bible_translations
    ORDER BY CASE WHEN id = 'default-esv' THEN 0 ELSE 1 END, created_at, name
  `).all<BibleTranslation>();
  return result.results;
}

export async function getBibleTranslation(id: string): Promise<BibleTranslation | null> {
  const db = await ensureTranslationStore();
  return await db.prepare(`
    SELECT id, name, abbreviation, url, icon_key AS iconKey,
      created_at AS createdAt, created_by AS createdBy
    FROM bible_translations WHERE id = ?
  `).bind(id).first<BibleTranslation>();
}

export async function saveBibleTranslation(translation: Omit<BibleTranslation, "createdAt">) {
  const db = await ensureTranslationStore();
  await db.prepare(`
    INSERT INTO bible_translations (id, name, abbreviation, url, icon_key, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    translation.id,
    translation.name,
    translation.abbreviation,
    translation.url,
    translation.iconKey,
    translation.createdBy,
  ).run();
}

export async function updateBibleTranslation(translation: Pick<BibleTranslation, "id" | "name" | "abbreviation" | "url" | "iconKey">) {
  const db = await ensureTranslationStore();
  await db.prepare(`
    UPDATE bible_translations
    SET name = ?, abbreviation = ?, url = ?, icon_key = ?
    WHERE id = ?
  `).bind(
    translation.name,
    translation.abbreviation,
    translation.url,
    translation.iconKey,
    translation.id,
  ).run();
}

export async function removeBibleTranslation(id: string) {
  const db = await ensureTranslationStore();
  await db.prepare("DELETE FROM bible_translations WHERE id = ?").bind(id).run();
}
