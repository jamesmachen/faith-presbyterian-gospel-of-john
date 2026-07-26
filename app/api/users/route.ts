import { signIn } from "@/auth";
import {
  getSiteUser,
  listSiteUsers,
  normalizeEmail,
  ownerAdminEmail,
  removeSiteUser,
  saveSiteUser,
  setSiteUserActive,
} from "@/db/access";
import { requireAdminApi } from "@/lib/admin-auth";
import { withBasePath } from "@/lib/base-path";
import { canManageAdministrator } from "@/lib/admin-policy";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendInvitation(email: string) {
  await signIn("resend", {
    email,
    redirect: false,
    redirectTo: withBasePath("/admin"),
  });
}

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  return Response.json({ users: await listSiteUsers() });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error || !auth.admin) return auth.error;
  const body = (await request.json()) as {
    email?: string;
    displayName?: string;
    action?: "invite";
  };
  const email = normalizeEmail(body.email ?? "");
  if (!EMAIL_PATTERN.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (body.action === "invite") {
    const existing = await getSiteUser(email);
    if (!existing || !existing.active) {
      return Response.json({ error: "Enable this administrator before sending an invitation." }, { status: 400 });
    }
    await sendInvitation(email);
    return Response.json({ ok: true });
  }

  await saveSiteUser(email, "admin", auth.admin.email, body.displayName);
  await sendInvitation(email);
  return Response.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error || !auth.admin) return auth.error;
  const body = (await request.json()) as { email?: string; active?: boolean };
  const email = normalizeEmail(body.email ?? "");
  if (!email) return Response.json({ error: "Choose an administrator." }, { status: 400 });
  if (!canManageAdministrator(auth.admin, email, ownerAdminEmail())) {
    return Response.json({ error: "Only the owner may manage this administrator." }, { status: 403 });
  }
  await setSiteUserActive(email, body.active !== false);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error || !auth.admin) return auth.error;
  const email = normalizeEmail(new URL(request.url).searchParams.get("email") ?? "");
  if (!email) return Response.json({ error: "Choose an administrator." }, { status: 400 });
  if (!canManageAdministrator(auth.admin, email, ownerAdminEmail())) {
    return Response.json({ error: "Only the owner may remove this administrator." }, { status: 403 });
  }
  await removeSiteUser(email);
  return Response.json({ ok: true });
}
