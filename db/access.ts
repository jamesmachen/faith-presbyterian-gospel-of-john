import { database } from "./postgres";

export type SiteRole = "owner" | "admin" | "visitor";
export type SiteStatus = "invited" | "active" | "disabled";

export type SiteUser = {
  email: string;
  role: SiteRole;
  displayName: string | null;
  active: boolean;
  status: SiteStatus;
  createdAt: string;
  createdBy: string;
  lastSignInAt: string | null;
};

const DEFAULT_OWNER = "jamesmachen@gmail.com";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function ownerAdminEmail() {
  return normalizeEmail(process.env.OWNER_ADMIN_EMAIL || DEFAULT_OWNER);
}

async function ensureAccessStore() {
  const sql = database();
  await sql`
    CREATE TABLE IF NOT EXISTS site_users (
      email TEXT PRIMARY KEY NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      display_name TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT NOT NULL,
      last_sign_in_at TIMESTAMPTZ
    )
  `;
  await sql`ALTER TABLE site_users ADD COLUMN IF NOT EXISTS display_name TEXT`;
  await sql`ALTER TABLE site_users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE site_users ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ`;
  await sql`ALTER TABLE site_users DROP CONSTRAINT IF EXISTS site_users_role_check`;
  await sql`
    ALTER TABLE site_users
    ADD CONSTRAINT site_users_role_check
    CHECK (role IN ('owner', 'admin', 'visitor'))
  `.catch(() => undefined);

  const owner = ownerAdminEmail();
  await sql`
    INSERT INTO site_users (email, role, active, created_by)
    VALUES (${owner}, 'owner', TRUE, 'initial site setup')
    ON CONFLICT(email) DO UPDATE SET role = 'owner', active = TRUE
  `;
  return sql;
}

function statusFor(user: { active: boolean; lastSignInAt: string | null }): SiteStatus {
  if (!user.active) return "disabled";
  return user.lastSignInAt ? "active" : "invited";
}

export async function getSiteUser(email: string): Promise<SiteUser | null> {
  const normalized = normalizeEmail(email);
  const sql = await ensureAccessStore();
  const [user] = await sql<Omit<SiteUser, "status">[]>`
    SELECT email, role, display_name AS "displayName", active,
      created_at AS "createdAt", created_by AS "createdBy",
      last_sign_in_at AS "lastSignInAt"
    FROM site_users WHERE email = ${normalized}
  `;
  if (!user) return null;
  if (normalized === ownerAdminEmail()) {
    user.role = "owner";
    user.active = true;
  }
  return { ...user, status: statusFor(user) };
}

export async function getSiteRole(email: string): Promise<SiteRole | null> {
  const user = await getSiteUser(email);
  return user?.active ? user.role : null;
}

export async function listSiteUsers(): Promise<SiteUser[]> {
  const sql = await ensureAccessStore();
  const users = await sql<Omit<SiteUser, "status">[]>`
    SELECT email, role, display_name AS "displayName", active,
      created_at AS "createdAt", created_by AS "createdBy",
      last_sign_in_at AS "lastSignInAt"
    FROM site_users
    WHERE role IN ('owner', 'admin')
    ORDER BY CASE WHEN role = 'owner' THEN 0 ELSE 1 END, email
  `;
  return users.map((user) => ({
    ...user,
    role: user.email === ownerAdminEmail() ? "owner" : user.role,
    active: user.email === ownerAdminEmail() ? true : user.active,
    status: statusFor({
      ...user,
      active: user.email === ownerAdminEmail() ? true : user.active,
    }),
  }));
}

export async function saveSiteUser(
  email: string,
  role: "admin",
  createdBy: string,
  displayName?: string | null,
) {
  const normalized = normalizeEmail(email);
  const sql = await ensureAccessStore();
  if (normalized === ownerAdminEmail()) return;
  await sql`
    INSERT INTO site_users (email, role, display_name, active, created_by)
    VALUES (
      ${normalized},
      ${role},
      ${displayName?.trim() || null},
      TRUE,
      ${normalizeEmail(createdBy)}
    )
    ON CONFLICT(email) DO UPDATE SET
      role = 'admin',
      display_name = COALESCE(EXCLUDED.display_name, site_users.display_name),
      active = TRUE
  `;
}

export async function setSiteUserActive(email: string, active: boolean) {
  const normalized = normalizeEmail(email);
  if (normalized === ownerAdminEmail()) {
    throw new Error("The owner account cannot be disabled.");
  }
  const sql = await ensureAccessStore();
  await sql`UPDATE site_users SET active = ${active} WHERE email = ${normalized}`;
  if (!active) {
    await sql`
      DELETE FROM sessions
      WHERE "userId" IN (SELECT id FROM users WHERE LOWER(email) = ${normalized})
    `.catch(() => undefined);
  }
}

export async function removeSiteUser(email: string) {
  const normalized = normalizeEmail(email);
  if (normalized === ownerAdminEmail()) {
    throw new Error("The owner account cannot be removed.");
  }
  const sql = await ensureAccessStore();
  await sql`DELETE FROM site_users WHERE email = ${normalized}`;
  await sql`
    DELETE FROM sessions
    WHERE "userId" IN (SELECT id FROM users WHERE LOWER(email) = ${normalized})
  `.catch(() => undefined);
}

export async function countUsableAdmins() {
  const sql = await ensureAccessStore();
  const [result] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM site_users
    WHERE role IN ('owner', 'admin') AND active = TRUE
  `;
  return result?.count ?? 0;
}
