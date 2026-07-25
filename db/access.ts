import { env } from "cloudflare:workers";

export type SiteRole = "visitor" | "admin";

export type SiteUser = {
  email: string;
  role: SiteRole;
  createdAt: string;
  createdBy: string;
};

const INITIAL_ADMIN = "jamesmachen@gmail.com";

function database() {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("The site access database is unavailable.");
  return db;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function ensureAccessStore() {
  const db = database();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS site_users (
      email TEXT PRIMARY KEY NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('visitor', 'admin')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT NOT NULL
    )
  `).run();
  const count = await db.prepare("SELECT COUNT(*) AS count FROM site_users").first<{ count: number }>();
  if (!count?.count) {
    await db.prepare("INSERT OR IGNORE INTO site_users (email, role, created_by) VALUES (?, 'admin', ?)")
      .bind(INITIAL_ADMIN, "initial site setup")
      .run();
  }
  return db;
}

export async function getSiteRole(email: string): Promise<SiteRole | null> {
  const db = await ensureAccessStore();
  const result = await db.prepare("SELECT role FROM site_users WHERE email = ?")
    .bind(normalizeEmail(email))
    .first<{ role: SiteRole }>();
  return result?.role ?? null;
}

export async function listSiteUsers(): Promise<SiteUser[]> {
  const db = await ensureAccessStore();
  const result = await db.prepare("SELECT email, role, created_at AS createdAt, created_by AS createdBy FROM site_users ORDER BY role, email").all<SiteUser>();
  return result.results;
}

export async function saveSiteUser(email: string, role: SiteRole, createdBy: string) {
  const db = await ensureAccessStore();
  await db.prepare(`
    INSERT INTO site_users (email, role, created_by)
    VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET role = excluded.role
  `).bind(normalizeEmail(email), role, normalizeEmail(createdBy)).run();
}

export async function removeSiteUser(email: string) {
  const db = await ensureAccessStore();
  await db.prepare("DELETE FROM site_users WHERE email = ?").bind(normalizeEmail(email)).run();
}

export async function countAdmins() {
  const db = await ensureAccessStore();
  const result = await db.prepare("SELECT COUNT(*) AS count FROM site_users WHERE role = 'admin'").first<{ count: number }>();
  return result?.count ?? 0;
}
