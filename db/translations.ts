import { database } from "./postgres";

export type BibleTranslation = {
  id: string;
  name: string;
  abbreviation: string;
  url: string;
  iconKey: string | null;
  createdAt: string;
  createdBy: string;
};

async function ensureTranslationStore() {
  const sql = database();
  await sql`
    CREATE TABLE IF NOT EXISTS bible_translations (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      abbreviation TEXT NOT NULL,
      url TEXT NOT NULL,
      icon_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT NOT NULL
    )
  `;
  await sql`
    INSERT INTO bible_translations (id, name, abbreviation, url, created_by)
    VALUES ('default-esv', 'English Standard Version', 'ESV', 'https://www.esv.org/John+1/', 'initial site setup')
    ON CONFLICT (id) DO NOTHING
  `;
  return sql;
}

export async function listBibleTranslations(): Promise<BibleTranslation[]> {
  const sql = await ensureTranslationStore();
  return sql<BibleTranslation[]>`
    SELECT id, name, abbreviation, url, icon_key AS "iconKey",
      created_at AS "createdAt", created_by AS "createdBy"
    FROM bible_translations
    ORDER BY CASE WHEN id = 'default-esv' THEN 0 ELSE 1 END, created_at, name
  `;
}

export async function getBibleTranslation(id: string): Promise<BibleTranslation | null> {
  const sql = await ensureTranslationStore();
  const [translation] = await sql<BibleTranslation[]>`
    SELECT id, name, abbreviation, url, icon_key AS "iconKey",
      created_at AS "createdAt", created_by AS "createdBy"
    FROM bible_translations WHERE id = ${id}
  `;
  return translation ?? null;
}

export async function saveBibleTranslation(translation: Omit<BibleTranslation, "createdAt">) {
  const sql = await ensureTranslationStore();
  await sql`
    INSERT INTO bible_translations (id, name, abbreviation, url, icon_key, created_by)
    VALUES (
      ${translation.id},
      ${translation.name},
      ${translation.abbreviation},
      ${translation.url},
      ${translation.iconKey},
      ${translation.createdBy}
    )
  `;
}

export async function updateBibleTranslation(translation: Pick<BibleTranslation, "id" | "name" | "abbreviation" | "url" | "iconKey">) {
  const sql = await ensureTranslationStore();
  await sql`
    UPDATE bible_translations
    SET name = ${translation.name},
      abbreviation = ${translation.abbreviation},
      url = ${translation.url},
      icon_key = ${translation.iconKey}
    WHERE id = ${translation.id}
  `;
}

export async function removeBibleTranslation(id: string) {
  const sql = await ensureTranslationStore();
  await sql`DELETE FROM bible_translations WHERE id = ${id}`;
}
