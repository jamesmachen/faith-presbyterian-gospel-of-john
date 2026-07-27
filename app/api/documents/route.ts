import { getStorage } from "@/lib/blob-storage";
import { requireAdminApi } from "@/lib/admin-auth";
import { mergeAssetMetadata, normalizeDisplayText } from "@/lib/asset-metadata";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const dynamic = "force-dynamic";

const PREFIX = "documents/";
const MAX_FILE_SIZE = 5_000_000_000_000;

function getBucket() {
  return getStorage();
}

function safeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").slice(0, 150) || "document";
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
      .map((object) => {
        const filename = object.customMetadata?.originalName || object.key.slice(PREFIX.length);
        return {
          key: object.key,
          name: filename,
          filename,
          displayText: normalizeDisplayText(object.customMetadata?.displayText, filename),
          size: object.size,
          uploaded: object.uploaded.toISOString(),
        };
      })
      .sort((a, b) => b.uploaded.localeCompare(a.uploaded));
    return Response.json({ documents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document storage is unavailable.";
    return Response.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
        const auth = await requireAdminApi();
        if (auth.error || !auth.admin) throw new Error("Administrator access is required.");
        if (!pathname.startsWith(PREFIX) || pathname.endsWith(".metadata.json")) {
          throw new Error("Invalid class material pathname.");
        }
        if (!multipart) throw new Error("Class Materials uploads must use multipart mode.");

        const payload = clientPayload
          ? (JSON.parse(clientPayload) as { filename?: string })
          : {};
        const filename = safeFilename(payload.filename ?? "");
        if (!pathname.endsWith(`-${filename}`)) throw new Error("The upload filename is invalid.");

        return {
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The upload could not be completed.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  try {
    const body = (await request.json()) as { key?: string; displayText?: string; filename?: string };
    const key = body.key ?? "";
    if (!key.startsWith(PREFIX)) return Response.json({ error: "Invalid document key." }, { status: 400 });
    const bucket = getBucket();
    const object = await bucket.head(key);
    if (!object) return Response.json({ error: "Document not found." }, { status: 404 });
    const filename = object.customMetadata?.originalName || safeFilename(body.filename || key.slice(PREFIX.length));
    const metadata: Record<string, string> = mergeAssetMetadata(object.customMetadata, body.displayText, filename);
    metadata.originalName = filename;
    metadata.uploadedBy ||= auth.admin?.email ?? "";
    await bucket.updateCustomMetadata(key, metadata);
    return Response.json({ ok: true, displayText: metadata.displayText, filename });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The display text could not be updated.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdminApi();
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
