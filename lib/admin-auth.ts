import { auth } from "@/auth";
import {
  getSiteUser,
  normalizeEmail,
  ownerAdminEmail,
  type SiteUser,
} from "@/db/access";
import { withBasePath } from "@/lib/base-path";
import { redirect } from "next/navigation";
import { resolveAdminRole } from "@/lib/admin-policy";

export type AuthenticatedAdmin = Omit<SiteUser, "role"> & {
  role: "owner" | "admin";
  sessionName: string | null;
};

export async function getAuthenticatedAdmin(): Promise<AuthenticatedAdmin | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  const sessionName = session.user?.name ?? null;

  const normalized = normalizeEmail(email);
  const user = await getSiteUser(normalized);
  const role = resolveAdminRole(
    normalized,
    session.expires,
    ownerAdminEmail(),
    user,
  );
  if (role === "owner") {
    const owner = user;
    return {
      ...owner!,
      role: "owner",
      active: true,
      sessionName,
    };
  }

  if (role !== "admin" || !user) return null;
  return { ...user, role: "admin", sessionName };
}

export async function requireAdminPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect(withBasePath("/admin/signin"));
  }
  return {
    admin: await getAuthenticatedAdmin(),
    authenticatedEmail: normalizeEmail(session.user.email),
  };
}

export async function requireAdminApi() {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return {
      error: Response.json(
        { error: "Administrator authentication is required." },
        { status: 401 },
      ),
    };
  }
  return { admin };
}
