import type { StudyPassageConfig } from "@/app/site-config";
import { getSiteRole, normalizeEmail } from "@/db/access";
import { listStudyPassages, saveStudyPassages } from "@/db/site-config";

export const dynamic = "force-dynamic";

async function requireAdmin(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  if (!email) return Response.json({ error: "Please sign in as an administrator." }, { status: 401 });
  const normalized = normalizeEmail(email);
  if (await getSiteRole(normalized) !== "admin") return Response.json({ error: "Administrator access is required." }, { status: 403 });
  return null;
}

function cleanLabel(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET(request: Request) {
  const error = await requireAdmin(request);
  if (error) return error;
  return Response.json({ passages: await listStudyPassages() });
}

export async function PUT(request: Request) {
  const error = await requireAdmin(request);
  if (error) return error;
  const body = (await request.json()) as { passages?: Partial<StudyPassageConfig>[] };
  if (!Array.isArray(body.passages) || body.passages.length === 0 || body.passages.length > 40) {
    return Response.json({ error: "The study schedule is invalid." }, { status: 400 });
  }
  const passages = body.passages.map((passage, index) => ({
    id: cleanLabel(passage.id, 80),
    weekLabel: cleanLabel(passage.weekLabel, 40),
    scriptureLabel: cleanLabel(passage.scriptureLabel, 100),
    descriptionLabel: cleanLabel(passage.descriptionLabel, 160),
    displayOrder: Number.isInteger(passage.displayOrder) ? Number(passage.displayOrder) : index,
  }));
  if (passages.some((passage) => !passage.id || !passage.weekLabel || !passage.scriptureLabel || !passage.descriptionLabel)) {
    return Response.json({ error: "Complete every schedule label before saving." }, { status: 400 });
  }
  if (new Set(passages.map((passage) => passage.id)).size !== passages.length) {
    return Response.json({ error: "The schedule contains duplicate entries." }, { status: 400 });
  }
  await saveStudyPassages(passages);
  return Response.json({ ok: true, passages: await listStudyPassages() });
}
