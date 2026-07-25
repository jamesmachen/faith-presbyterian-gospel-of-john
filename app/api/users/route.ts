import { countAdmins, getSiteRole, listSiteUsers, normalizeEmail, removeSiteUser, saveSiteUser } from "@/db/access";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireAdmin(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  if (!email) return { error: Response.json({ error: "Please sign in." }, { status: 401 }) };
  const normalized = normalizeEmail(email);
  if (await getSiteRole(normalized) !== "admin") return { error: Response.json({ error: "Administrator access is required." }, { status: 403 }) };
  return { email: normalized };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  return Response.json({ users: (await listSiteUsers()).filter((user) => user.role === "admin") });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.email) return auth.error;
  const body = (await request.json()) as { email?: string };
  const email = normalizeEmail(body.email ?? "");
  if (!EMAIL_PATTERN.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  await saveSiteUser(email, "admin", auth.email);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.email) return auth.error;
  const email = normalizeEmail(new URL(request.url).searchParams.get("email") ?? "");
  if (!email) return Response.json({ error: "Choose a user to remove." }, { status: 400 });
  if (email === auth.email) return Response.json({ error: "You cannot remove your own access." }, { status: 400 });
  const role = await getSiteRole(email);
  if (role === "admin" && await countAdmins() <= 1) return Response.json({ error: "The site must retain at least one administrator." }, { status: 400 });
  await removeSiteUser(email);
  return Response.json({ ok: true });
}
