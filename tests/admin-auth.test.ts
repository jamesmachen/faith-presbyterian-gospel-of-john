import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canManageAdministrator,
  normalizeIdentityEmail,
  resolveAdminRole,
} from "../lib/admin-policy";

const future = new Date(Date.now() + 60_000).toISOString();
const past = new Date(Date.now() - 60_000).toISOString();
const owner = "jamesmachen@gmail.com";

test("normalizes mixed-case email addresses", () => {
  assert.equal(normalizeIdentityEmail("  JamesMachen@GMAIL.com "), owner);
});

test("rejects unauthenticated, expired, unlisted, and disabled users", () => {
  assert.equal(resolveAdminRole(null, future, owner, null), null);
  assert.equal(resolveAdminRole("person@example.com", past, owner, { email: "person@example.com", role: "admin", active: true }), null);
  assert.equal(resolveAdminRole("person@example.com", future, owner, null), null);
  assert.equal(resolveAdminRole("person@example.com", future, owner, { email: "person@example.com", role: "admin", active: false }), null);
});

test("always grants owner access to the configured owner after authentication", () => {
  assert.equal(resolveAdminRole("JamesMachen@GMAIL.com", future, owner, null), "owner");
});

test("grants active allowlisted administrators access", () => {
  assert.equal(resolveAdminRole("admin@example.com", future, owner, { email: "ADMIN@example.com", role: "admin", active: true }), "admin");
});

test("only the owner can manage another non-owner administrator", () => {
  assert.equal(canManageAdministrator({ email: owner, role: "owner" }, "admin@example.com", owner), true);
  assert.equal(canManageAdministrator({ email: "admin@example.com", role: "admin" }, "other@example.com", owner), false);
  assert.equal(canManageAdministrator({ email: owner, role: "owner" }, owner, owner), false);
  assert.equal(canManageAdministrator({ email: owner, role: "owner" }, owner.toUpperCase(), owner), false);
});

test("all administrator mutation routes use validated server sessions", async () => {
  const routeFiles = [
    "app/api/users/route.ts",
    "app/api/documents/route.ts",
    "app/api/images/route.ts",
    "app/api/site-config/route.ts",
    "app/api/translations/route.ts",
  ];
  for (const path of routeFiles) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /requireAdminApi/);
    assert.doesNotMatch(source, /oai-authenticated-user|request\.headers\.get/);
  }
});

test("Auth.js uses internal paths while Next.js owns the Sunday School base path", async () => {
  const [authSource, routeSource, signInSource, adminAuthSource] = await Promise.all([
    readFile(new URL("../auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/[...nextauth]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/signin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/admin-auth.ts", import.meta.url), "utf8"),
  ]);
  assert.match(authSource, /basePath:\s*AUTH_INTERNAL_BASE_PATH/);
  assert.match(authSource, /signIn:\s*["']\/admin\/signin["']/);
  assert.match(authSource, /verifyRequest:\s*["']\/admin\/verify["']/);
  assert.doesNotMatch(authSource, /withBasePath/);
  assert.match(routeSource, /handlers/);
  assert.match(signInSource, /redirect:\s*false/);
  assert.match(signInSource, /redirect\(\s*[\s\S]*["']\/admin\/verify["']/);
  assert.doesNotMatch(signInSource, /withBasePath\(["']\/admin\/verify["']\)/);
  assert.doesNotMatch(signInSource, /withBasePath\(["']\/admin\/signin["']\)/);
  assert.match(signInSource, /catch\s*\{/);
  assert.match(signInSource, /error=EmailSignin/);
  assert.match(adminAuthSource, /redirect\(["']\/admin\/signin["']\)/);
  assert.doesNotMatch(adminAuthSource, /withBasePath/);
});
