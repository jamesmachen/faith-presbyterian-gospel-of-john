export type AdminRecord = {
  email: string;
  role: "owner" | "admin" | "visitor";
  active: boolean;
};

export function normalizeIdentityEmail(email: string) {
  return email.trim().toLowerCase();
}

export function resolveAdminRole(
  sessionEmail: string | null | undefined,
  sessionExpires: string | null | undefined,
  ownerEmail: string,
  record: AdminRecord | null,
) {
  if (!sessionEmail || !sessionExpires || new Date(sessionExpires).getTime() <= Date.now()) {
    return null;
  }
  const email = normalizeIdentityEmail(sessionEmail);
  const owner = normalizeIdentityEmail(ownerEmail);
  if (email === owner) return "owner" as const;
  if (!record || normalizeIdentityEmail(record.email) !== email || !record.active) return null;
  return record.role === "admin" ? ("admin" as const) : null;
}

export function canManageAdministrator(
  actor: { email: string; role: "owner" | "admin" },
  targetEmail: string,
  ownerEmail: string,
) {
  const target = normalizeIdentityEmail(targetEmail);
  return (
    actor.role === "owner" &&
    target !== normalizeIdentityEmail(actor.email) &&
    target !== normalizeIdentityEmail(ownerEmail)
  );
}
