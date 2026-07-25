import { del, list, put } from "@vercel/blob";

type ObjectMetadata = Record<string, string>;
type PutOptions = {
  httpMetadata?: { contentType?: string };
  customMetadata?: ObjectMetadata;
};

type ListedBlob = {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: Date;
  contentType?: string;
};

const METADATA_SUFFIX = ".metadata.json";

function token() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "File storage is not configured. Connect Vercel Blob and provide BLOB_READ_WRITE_TOKEN.",
    );
  }
  return process.env.BLOB_READ_WRITE_TOKEN;
}

async function allBlobs(prefix: string) {
  const blobs: ListedBlob[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({ prefix, cursor, token: token() });
    blobs.push(...(page.blobs as ListedBlob[]));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return blobs;
}

async function findBlob(key: string) {
  const blobs = await allBlobs(key);
  return blobs.find((blob) => blob.pathname === key) ?? null;
}

async function readMetadata(key: string): Promise<ObjectMetadata | undefined> {
  const blob = await findBlob(`${key}${METADATA_SUFFIX}`);
  if (!blob) return undefined;
  const response = await fetch(blob.url);
  if (!response.ok) return undefined;
  return (await response.json()) as ObjectMetadata;
}

async function deleteKeys(keys: string[]) {
  const urls: string[] = [];
  for (const key of keys) {
    const [blob, metadata] = await Promise.all([
      findBlob(key),
      findBlob(`${key}${METADATA_SUFFIX}`),
    ]);
    if (blob) urls.push(blob.url);
    if (metadata) urls.push(metadata.url);
  }
  if (urls.length) await del(urls, { token: token() });
}

async function toStoredObject(blob: ListedBlob) {
  const response = await fetch(blob.url);
  if (!response.ok) return null;
  const customMetadata = await readMetadata(blob.pathname);
  const contentType =
    blob.contentType ??
    response.headers.get("content-type") ??
    "application/octet-stream";

  return {
    key: blob.pathname,
    size: blob.size,
    uploaded: new Date(blob.uploadedAt),
    body: response.body,
    customMetadata,
    arrayBuffer: () => response.arrayBuffer(),
    json: <T>() => response.json() as Promise<T>,
    writeHttpMetadata(headers: Headers) {
      headers.set("content-type", contentType);
    },
  };
}

export function getStorage() {
  return {
    async get(key: string) {
      const blob = await findBlob(key);
      return blob ? toStoredObject(blob) : null;
    },

    async head(key: string) {
      const blob = await findBlob(key);
      if (!blob) return null;
      return {
        key: blob.pathname,
        size: blob.size,
        uploaded: new Date(blob.uploadedAt),
        customMetadata: await readMetadata(key),
      };
    },

    async put(
      key: string,
      body: ArrayBuffer | Uint8Array | ReadableStream | string,
      options: PutOptions = {},
    ) {
      const contentType =
        options.httpMetadata?.contentType ?? "application/octet-stream";
      const putBody = body instanceof Uint8Array ? Buffer.from(body) : body;
      const blob = await put(key, putBody, {
        access: "public",
        addRandomSuffix: false,
        contentType,
        token: token(),
      });

      if (options.customMetadata) {
        await put(`${key}${METADATA_SUFFIX}`, JSON.stringify(options.customMetadata), {
          access: "public",
          addRandomSuffix: false,
          contentType: "application/json",
          token: token(),
        });
      }

      return blob;
    },

    async list(options: { prefix: string; include?: string[] }) {
      const blobs = (await allBlobs(options.prefix)).filter(
        (blob) => !blob.pathname.endsWith(METADATA_SUFFIX),
      );
      const objects = await Promise.all(
        blobs.map(async (blob) => ({
          key: blob.pathname,
          size: blob.size,
          uploaded: new Date(blob.uploadedAt),
          customMetadata: await readMetadata(blob.pathname),
        })),
      );
      return { objects };
    },

    async delete(keys: string | string[]) {
      await deleteKeys(Array.isArray(keys) ? keys : [keys]);
    },
  };
}
