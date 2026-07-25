import { database } from "./postgres";

export type SiteRole = "visitor" | "admin";

export type SiteUser = {
  email: string;
  role: SiteRole;
  createdAt: string;
  createdBy: string;
};

const INITIAL_ADMIN = "jamesmachen@gmail.com";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function ensureAccessStore() {
  const sql = database();
  await sql`
    CREATE TABLE IF NOT EXISTS site_users (
      email TEXT PRIMARY KEY NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('visitor', 'admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT NOT NULL
    )
  `;
  await sql`
    INSERT INTO site_users (email, role, created_by)
    VALUES (${INITIAL_ADMIN}, 'admin', 'initial site setup')
    ON CONFLICT (email) DO NOTHING
  `;
  return sql;
}

export async function getSiteRole(email: string): Promise<SiteRole | null> {
  const sql = await ensureAccessStore();
  const [result] = await sql<{ role: SiteRole }[]>`
    SELECT role FROM site_users WHERE email = ${normalizeEmail(email)}
  `;
  return result?.role ?? null;
}

export async function listSiteUsers(): Promise<SiteUser[]> {
  const sql = await ensureAccessStore();
  return sql<SiteUser[]>`
    SELECT email, role, created_at AS "createdAt", created_by AS "createdBy"
    FROM site_users ORDER BY role, email
  `;
}

export async function saveSiteUser(email: string, role: SiteRole, createdBy: string) {
  const sql = await ensureAccessStore();
  await sql`
    INSERT INTO site_users (email, role, created_by)
    VALUES (${normalizeEmail(email)}, ${role}, ${normalizeEmail(createdBy)})
    ON CONFLICT(email) DO UPDATE SET role = excluded.role
  `;
}

export async function removeSiteUser(email: string) {
  const sql = await ensureAccessStore();
  await sql`DELETE FROM site_users WHERE email = ${normalizeEmail(email)}`;
}

export async function countAdmins() {
  const sql = await ensureAccessStore();
  const [result] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM site_users WHERE role = 'admin'
  `;
  return result?.count ?? 0;
}
