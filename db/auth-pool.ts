import { Pool } from "pg";
import { getSiteUser, normalizeEmail, ownerAdminEmail } from "./access";

const rawPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

let initialization: Promise<void> | undefined;

export function ensureAuthSchema() {
  initialization ??= (async () => {
    await rawPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT,
        email TEXT UNIQUE,
        "emailVerified" TIMESTAMPTZ,
        image TEXT
      );
      CREATE TABLE IF NOT EXISTS accounts (
        id BIGSERIAL PRIMARY KEY,
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        "providerAccountId" TEXT NOT NULL,
        refresh_token TEXT,
        access_token TEXT,
        expires_at BIGINT,
        id_token TEXT,
        scope TEXT,
        session_state TEXT,
        token_type TEXT,
        UNIQUE(provider, "providerAccountId")
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id BIGSERIAL PRIMARY KEY,
        "sessionToken" TEXT UNIQUE NOT NULL,
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS verification_token (
        identifier TEXT NOT NULL,
        expires TIMESTAMPTZ NOT NULL,
        token TEXT NOT NULL,
        PRIMARY KEY(identifier, token)
      );
    `);
  })();
  return initialization;
}

export const authPool = new Proxy(rawPool, {
  get(target, property, receiver) {
    if (property === "query") {
      return async (...args: Parameters<Pool["query"]>) => {
        await ensureAuthSchema();
        return target.query(...args);
      };
    }
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
}) as Pool;

export async function recordSuccessfulSignIn(email: string, name?: string | null) {
  const normalized = normalizeEmail(email);
  const owner = ownerAdminEmail();
  await getSiteUser(normalized);
  const sql = await import("./postgres").then(({ database }) => database());
  await sql`
    UPDATE site_users
    SET last_sign_in_at = CURRENT_TIMESTAMP,
      display_name = COALESCE(${name?.trim() || null}, display_name),
      active = TRUE,
      role = CASE WHEN email = ${owner} THEN 'owner' ELSE role END
    WHERE email = ${normalized}
  `;
}
