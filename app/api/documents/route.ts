import { env } from "cloudflare:workers";
import { getSiteRole, normalizeEmail, SiteRole } from "@/db/access";

export const dynamic = "force-dynamic";

const PREFIX = "documents/";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt", "md", "rtf", "ppt", "pptx", "xls", "xlsx"]);

function getBucket() {
  const bucket = (env as unknown as { DOCUMENTS?: R2Bucket }).DOCUMENTS;
  if (!bucket) throw new Error("Document storage is not configured.");
  return bucket;
}

function safeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").slice(0, 150) || "document";
}

function extensionOf(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

async function authorize(request: Request, requiredRole?: SiteRole) {
  const email = request.headers.get("oai-authenticated-user-email");
  if (!email) return { error: Response.json({ error: "Please sign in." }, { status: 401 }) };
  const normalized = normalizeEmail(email);
  const role = await getSiteRole(normalized);
  if (!role) return { error: Response.json({ error: "Your account is not authorized for this site." }, { status: 403 }) };
  if (requiredRole && role !== requiredRole) return { error: Response.json({ error: "Administrator access is required." }, { status: 403 }) };
  return { email: normalized, role };
}

export async function GET(request: Request) {
  try {
    const bucket = getBucket();
    const key = new URL(request.url).searchParams.get("key");

    if (key) {
      if (!key.startsWith(PREFIX)) return Response.json({ error: "Invalid document key." }, { status: 400 });
      const object = await bucket.get(key);
      if (!object) return Response.json({ error: "Document not found." }, { status: 404 });
      const filename = safeFilename(object.customMetadata?.originalName || key.slice(PREFIX.length));
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("content-disposition", `attachment; filename="${filename.replace(/"/g, "")}"`);
      headers.set("cache-control", "private, max-age=60");
      return new Response(object.body, { headers });
    }

    const listed = await bucket.list({ prefix: PREFIX, include: ["customMetadata"] });
    const documents = listed.objects
      .map((object) => ({
        key: object.key,
        name: object.customMetadata?.originalName || object.key.slice(PREFIX.length),
        size: object.size,
        uploaded: object.uploaded.toISOString(),
      }))
      .sort((a, b) => b.uploaded.localeCompare(a.uploaded));
    return Response.json({ documents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document storage is unavailable.";
    return Response.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await authorize(request, "admin");
  if (auth.error || !auth.email) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a document to upload." }, { status: 400 });
    if (!file.size || file.size > MAX_FILE_SIZE) return Response.json({ error: "Documents must be smaller than 15 MB." }, { status: 400 });
    if (!ALLOWED_EXTENSIONS.has(extensionOf(file.name))) return Response.json({ error: "That document type is not supported." }, { status: 400 });

    const filename = safeFilename(file.name);
    const key = `${PREFIX}${Date.now()}-${crypto.randomUUID()}-${filename}`;
    await getBucket().put(key, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      customMetadata: { originalName: filename, uploadedBy: auth.email },
    });
    return Response.json({ ok: true, key, name: filename }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The upload could not be completed.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authorize(request, "admin");
  if (auth.error) return auth.error;
  const key = new URL(request.url).searchParams.get("key");
  if (!key?.startsWith(PREFIX)) return Response.json({ error: "Invalid document key." }, { status: 400 });
  try {
    const bucket = getBucket();
    const object = await bucket.head(key);
    if (!object) return Response.json({ error: "Document not found." }, { status: 404 });
    await bucket.delete(key);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The document could not be deleted.";
    return Response.json({ error: message }, { status: 500 });
  }
}
