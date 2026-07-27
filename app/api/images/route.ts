import { getStorage } from "@/lib/blob-storage";
import { requireAdminApi } from "@/lib/admin-auth";
import { mergeAssetMetadata, normalizeDisplayText } from "@/lib/asset-metadata";

export const dynamic = "force-dynamic";

const PREFIX = "images/";
const SESSION_PREFIX = "image-upload-sessions/";
const CHUNK_PREFIX = "image-upload-chunks/";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const CHUNK_SIZE = 256 * 1024;
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

type UploadSession = {
  id: string;
  finalKey: string;
  filename: string;
  displayText: string;
  contentType: string;
  size: number;
  chunkSize: number;
  totalChunks: number;
  uploadedBy: string;
};

function getBucket() {
  return getStorage();
}

function safeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").slice(0, 150) || "image";
}

function extensionOf(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function sessionKey(id: string) {
  return `${SESSION_PREFIX}${id}.json`;
}

function chunkKey(id: string, index: number) {
  return `${CHUNK_PREFIX}${id}/${index}`;
}

async function readSession(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const object = await getBucket().get(sessionKey(id));
  return object ? await object.json<UploadSession>() : null;
}

async function requireOwnedSession(id: string, email: string) {
  const session = await readSession(id);
  if (!session) return { error: Response.json({ error: "This upload session has expired. Please choose the image again." }, { status: 404 }) };
  if (session.uploadedBy !== email) return { error: Response.json({ error: "Administrator access is required." }, { status: 403 }) };
  return { session };
}

export async function GET(request: Request) {
  try {
    const bucket = getBucket();
    const key = new URL(request.url).searchParams.get("key");
    if (key) {
      if (!key.startsWith(PREFIX)) return Response.json({ error: "Invalid image key." }, { status: 400 });
      const object = await bucket.get(key);
      if (!object) return Response.json({ error: "Image not found." }, { status: 404 });
      const filename = safeFilename(object.customMetadata?.originalName || key.slice(PREFIX.length));
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("content-disposition", `attachment; filename="${filename.replace(/"/g, "")}"`);
      headers.set("cache-control", "public, max-age=60");
      return new Response(object.body, { headers });
    }
    const listed = await bucket.list({ prefix: PREFIX, include: ["customMetadata"] });
    const images = listed.objects.map((object) => {
      const filename = object.customMetadata?.originalName || object.key.slice(PREFIX.length);
      return {
        key: object.key,
        name: filename,
        filename,
        displayText: normalizeDisplayText(object.customMetadata?.displayText, filename),
        size: object.size,
        uploaded: object.uploaded.toISOString(),
      };
    }).sort((a, b) => b.uploaded.localeCompare(a.uploaded));
    return Response.json({ images });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Image storage is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error || !auth.admin) return auth.error;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "start";
  try {
    if (action === "start") {
      const body = (await request.json()) as { name?: string; displayText?: string; size?: number; type?: string };
      const filename = safeFilename(body.name ?? "");
      const displayText = normalizeDisplayText(body.displayText, filename);
      const size = Number(body.size);
      const contentType = body.type ?? "";
      if (!size || size > MAX_FILE_SIZE) return Response.json({ error: "Images must be smaller than 10 MB." }, { status: 400 });
      if (!ALLOWED_TYPES.has(contentType) || !ALLOWED_EXTENSIONS.has(extensionOf(filename))) return Response.json({ error: "That image type is not supported." }, { status: 400 });
      const id = crypto.randomUUID();
      const session: UploadSession = {
        id,
        finalKey: `${PREFIX}${Date.now()}-${crypto.randomUUID()}-${filename}`,
        filename,
        displayText,
        contentType,
        size,
        chunkSize: CHUNK_SIZE,
        totalChunks: Math.ceil(size / CHUNK_SIZE),
        uploadedBy: auth.admin.email,
      };
      await getBucket().put(sessionKey(id), JSON.stringify(session), { httpMetadata: { contentType: "application/json" } });
      return Response.json({ sessionId: id, chunkSize: CHUNK_SIZE, totalChunks: session.totalChunks }, { status: 201 });
    }

    const sessionId = url.searchParams.get("sessionId") ?? "";
    const owned = await requireOwnedSession(sessionId, auth.admin.email);
    if (owned.error || !owned.session) return owned.error;
    const session = owned.session;

    if (action === "chunk") {
      const index = Number(url.searchParams.get("index"));
      if (!Number.isInteger(index) || index < 0 || index >= session.totalChunks) return Response.json({ error: "Invalid upload piece." }, { status: 400 });
      const bytes = await request.arrayBuffer();
      const expectedSize = Math.min(session.chunkSize, session.size - index * session.chunkSize);
      if (bytes.byteLength !== expectedSize) return Response.json({ error: "An upload piece was incomplete. Please try again." }, { status: 400 });
      await getBucket().put(chunkKey(session.id, index), bytes);
      return Response.json({ ok: true, index });
    }

    if (action === "complete") {
      const storage = getBucket();
      const complete = new Uint8Array(session.size);
      const temporaryKeys: string[] = [];
      let offset = 0;
      for (let index = 0; index < session.totalChunks; index += 1) {
        const key = chunkKey(session.id, index);
        const part = await storage.get(key);
        if (!part) return Response.json({ error: "An upload piece is missing. Please try the upload again." }, { status: 409 });
        const bytes = new Uint8Array(await part.arrayBuffer());
        complete.set(bytes, offset);
        offset += bytes.byteLength;
        temporaryKeys.push(key);
      }
      if (offset !== session.size) return Response.json({ error: "The uploaded image size did not match the original file." }, { status: 400 });
      await storage.put(session.finalKey, complete, {
        httpMetadata: { contentType: session.contentType },
        customMetadata: { originalName: session.filename, displayText: session.displayText, uploadedBy: auth.admin.email },
      });
      await storage.delete([...temporaryKeys, sessionKey(session.id)]);
      return Response.json({ ok: true, key: session.finalKey, name: session.filename }, { status: 201 });
    }

    return Response.json({ error: "Invalid upload action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The upload could not be completed." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  try {
    const body = (await request.json()) as { key?: string; displayText?: string };
    const key = body.key ?? "";
    if (!key.startsWith(PREFIX)) return Response.json({ error: "Invalid image key." }, { status: 400 });
    const bucket = getBucket();
    const object = await bucket.head(key);
    if (!object) return Response.json({ error: "Image not found." }, { status: 404 });
    const filename = object.customMetadata?.originalName || key.slice(PREFIX.length);
    const metadata = mergeAssetMetadata(object.customMetadata, body.displayText, filename);
    await bucket.updateCustomMetadata(key, metadata);
    return Response.json({ ok: true, displayText: metadata.displayText, filename });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The display text could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const key = new URL(request.url).searchParams.get("key");
  if (!key?.startsWith(PREFIX)) return Response.json({ error: "Invalid image key." }, { status: 400 });
  try {
    const bucket = getBucket();
    if (!await bucket.head(key)) return Response.json({ error: "Image not found." }, { status: 404 });
    await bucket.delete(key);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The image could not be deleted." }, { status: 500 });
  }
}
