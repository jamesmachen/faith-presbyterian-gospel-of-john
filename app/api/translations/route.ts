import { getSiteRole, normalizeEmail } from "@/db/access";
import { getBibleTranslation, listBibleTranslations, removeBibleTranslation, saveBibleTranslation, updateBibleTranslation } from "@/db/translations";
import { getStorage } from "@/lib/blob-storage";

export const dynamic = "force-dynamic";

const ICON_PREFIX = "translation-icons/";
const ICON_SESSION_PREFIX = "translation-icon-upload-sessions/";
const ICON_CHUNK_PREFIX = "translation-icon-upload-chunks/";
const MAX_ICON_SIZE = 10 * 1024 * 1024;
const ICON_CHUNK_SIZE = 256 * 1024;
const ALLOWED_ICON_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

type IconUploadSession = {
  id: string;
  iconKey: string;
  contentType: string;
  size: number;
  chunkSize: number;
  totalChunks: number;
  uploadedBy: string;
};

function bucket() {
  return getStorage();
}

function iconSessionKey(id: string) {
  return `${ICON_SESSION_PREFIX}${id}.json`;
}

function iconChunkKey(id: string, index: number) {
  return `${ICON_CHUNK_PREFIX}${id}/${index}`;
}

async function requireAdmin(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  if (!email) return { error: Response.json({ error: "Please sign in as an administrator." }, { status: 401 }) };
  const normalized = normalizeEmail(email);
  if (await getSiteRole(normalized) !== "admin") return { error: Response.json({ error: "Administrator access is required." }, { status: 403 }) };
  return { email: normalized };
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function readIconSession(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const object = await bucket().get(iconSessionKey(id));
  return object ? await object.json<IconUploadSession>() : null;
}

async function requireOwnedIconSession(id: string, email: string) {
  const session = await readIconSession(id);
  if (!session) return { error: Response.json({ error: "This icon upload has expired. Please choose the icon again." }, { status: 404 }) };
  if (session.uploadedBy !== email) return { error: Response.json({ error: "Administrator access is required." }, { status: 403 }) };
  return { session };
}

export async function GET(request: Request) {
  try {
    const iconKey = new URL(request.url).searchParams.get("iconKey");
    if (iconKey) {
      if (!iconKey.startsWith(ICON_PREFIX)) return Response.json({ error: "Invalid icon key." }, { status: 400 });
      const object = await bucket().get(iconKey);
      if (!object) return Response.json({ error: "Icon not found." }, { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("content-disposition", "inline");
      headers.set("cache-control", "public, max-age=3600");
      return new Response(object.body, { headers });
    }
    return Response.json({ translations: await listBibleTranslations() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Translations are unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.email) return auth.error;
  const requestUrl = new URL(request.url);
  const action = requestUrl.searchParams.get("action") || "create";

  try {
    if (action === "icon-start") {
      const body = (await request.json()) as { size?: number; type?: string };
      const size = Number(body.size);
      const contentType = body.type ?? "";
      if (!size || size > MAX_ICON_SIZE) return Response.json({ error: "Icons must be smaller than 10 MB." }, { status: 400 });
      if (!ALLOWED_ICON_TYPES.has(contentType)) return Response.json({ error: "Use a PNG, JPG, WEBP, or GIF icon." }, { status: 400 });
      const id = crypto.randomUUID();
      const session: IconUploadSession = {
        id,
        iconKey: `${ICON_PREFIX}${Date.now()}-${crypto.randomUUID()}`,
        contentType,
        size,
        chunkSize: ICON_CHUNK_SIZE,
        totalChunks: Math.ceil(size / ICON_CHUNK_SIZE),
        uploadedBy: auth.email,
      };
      await bucket().put(iconSessionKey(id), JSON.stringify(session), { httpMetadata: { contentType: "application/json" } });
      return Response.json({ sessionId: id, chunkSize: session.chunkSize, totalChunks: session.totalChunks }, { status: 201 });
    }

    if (action === "icon-chunk" || action === "icon-complete") {
      const sessionId = requestUrl.searchParams.get("sessionId") ?? "";
      const owned = await requireOwnedIconSession(sessionId, auth.email);
      if (owned.error || !owned.session) return owned.error;
      const session = owned.session;

      if (action === "icon-chunk") {
        const index = Number(requestUrl.searchParams.get("index"));
        if (!Number.isInteger(index) || index < 0 || index >= session.totalChunks) return Response.json({ error: "Invalid icon upload piece." }, { status: 400 });
        const bytes = await request.arrayBuffer();
        const expectedSize = Math.min(session.chunkSize, session.size - index * session.chunkSize);
        if (bytes.byteLength !== expectedSize) return Response.json({ error: "An icon upload piece was incomplete. Please try again." }, { status: 400 });
        await bucket().put(iconChunkKey(session.id, index), bytes);
        return Response.json({ ok: true, index });
      }

      const storage = bucket();
      const complete = new Uint8Array(session.size);
      const temporaryKeys: string[] = [];
      let offset = 0;
      for (let index = 0; index < session.totalChunks; index += 1) {
        const key = iconChunkKey(session.id, index);
        const part = await storage.get(key);
        if (!part) return Response.json({ error: "An icon upload piece is missing. Please try again." }, { status: 409 });
        const bytes = new Uint8Array(await part.arrayBuffer());
        complete.set(bytes, offset);
        offset += bytes.byteLength;
        temporaryKeys.push(key);
      }
      if (offset !== session.size) return Response.json({ error: "The uploaded icon size did not match the original file." }, { status: 400 });
      await storage.put(session.iconKey, complete, {
        httpMetadata: { contentType: session.contentType },
        customMetadata: { uploadedBy: auth.email, kind: "bible-translation-icon" },
      });
      await storage.delete([...temporaryKeys, iconSessionKey(session.id)]);
      return Response.json({ ok: true, iconKey: session.iconKey }, { status: 201 });
    }

    if (action !== "create") return Response.json({ error: "Invalid translation action." }, { status: 400 });

    const body = (await request.json()) as { name?: string; abbreviation?: string; url?: string; iconKey?: string | null };
    const name = cleanText(body.name, 80);
    const abbreviation = cleanText(body.abbreviation, 10).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const urlValue = cleanText(body.url, 500);
    const iconKey = cleanText(body.iconKey, 300) || null;
    if (!name) return Response.json({ error: "Enter the translation name." }, { status: 400 });
    if (abbreviation.length < 2) return Response.json({ error: "Enter a 2–10 character abbreviation." }, { status: 400 });
    let url: URL;
    try { url = new URL(urlValue); } catch { return Response.json({ error: "Enter a valid Bible link." }, { status: 400 }); }
    if (!new Set(["https:", "http:"]).has(url.protocol)) return Response.json({ error: "The Bible link must begin with http or https." }, { status: 400 });
    if (iconKey) {
      if (!iconKey.startsWith(ICON_PREFIX)) return Response.json({ error: "Invalid translation icon." }, { status: 400 });
      const icon = await bucket().head(iconKey);
      if (!icon || icon.customMetadata?.uploadedBy !== auth.email) return Response.json({ error: "The translation icon could not be verified." }, { status: 400 });
    }

    try {
      await saveBibleTranslation({
        id: crypto.randomUUID(),
        name,
        abbreviation,
        url: url.toString(),
        iconKey,
        createdBy: auth.email,
      });
    } catch (error) {
      if (iconKey) await bucket().delete(iconKey);
      throw error;
    }
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The translation could not be added." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return Response.json({ error: "Choose a translation to remove." }, { status: 400 });
  try {
    const translation = await getBibleTranslation(id);
    if (!translation) return Response.json({ error: "Translation not found." }, { status: 404 });
    await removeBibleTranslation(id);
    if (translation.iconKey) await bucket().delete(translation.iconKey);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The translation could not be removed." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.email) return auth.error;
  let uploadedReplacementKey: string | null = null;
  try {
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      abbreviation?: string;
      url?: string;
      iconKey?: string | null;
      removeIcon?: boolean;
    };
    const id = cleanText(body.id, 80);
    const name = cleanText(body.name, 80);
    const abbreviation = cleanText(body.abbreviation, 10).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const urlValue = cleanText(body.url, 500);
    uploadedReplacementKey = cleanText(body.iconKey, 300) || null;
    if (!id) return Response.json({ error: "Choose a Bible resource to edit." }, { status: 400 });
    if (!name) return Response.json({ error: "Enter the translation name." }, { status: 400 });
    if (abbreviation.length < 2) return Response.json({ error: "Enter a 2–10 character abbreviation." }, { status: 400 });
    let url: URL;
    try { url = new URL(urlValue); } catch { return Response.json({ error: "Enter a valid Bible link." }, { status: 400 }); }
    if (!new Set(["https:", "http:"]).has(url.protocol)) return Response.json({ error: "The Bible link must begin with http or https." }, { status: 400 });

    const existing = await getBibleTranslation(id);
    if (!existing) return Response.json({ error: "Bible resource not found." }, { status: 404 });
    if (uploadedReplacementKey) {
      if (!uploadedReplacementKey.startsWith(ICON_PREFIX)) return Response.json({ error: "Invalid replacement icon." }, { status: 400 });
      const icon = await bucket().head(uploadedReplacementKey);
      if (!icon || icon.customMetadata?.uploadedBy !== auth.email) return Response.json({ error: "The replacement icon could not be verified." }, { status: 400 });
    }

    const nextIconKey = body.removeIcon ? null : uploadedReplacementKey || existing.iconKey;
    await updateBibleTranslation({ id, name, abbreviation, url: url.toString(), iconKey: nextIconKey });
    if (existing.iconKey && existing.iconKey !== nextIconKey) await bucket().delete(existing.iconKey).catch(() => undefined);
    uploadedReplacementKey = null;
    return Response.json({ ok: true });
  } catch (error) {
    if (uploadedReplacementKey) await bucket().delete(uploadedReplacementKey).catch(() => undefined);
    return Response.json({ error: error instanceof Error ? error.message : "The Bible resource could not be updated." }, { status: 500 });
  }
}
