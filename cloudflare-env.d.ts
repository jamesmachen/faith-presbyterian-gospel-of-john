declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
    DOCUMENTS?: R2Bucket;
    [key: string]: unknown;
  };
}

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface R2Object {
  key: string;
  size: number;
  uploaded: Date;
  customMetadata?: Record<string, string>;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  writeHttpMetadata(headers: Headers): void;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  put(key: string, value: ReadableStream, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<R2Object>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; include?: Array<"httpMetadata" | "customMetadata"> }): Promise<{ objects: R2Object[] }>;
}

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}
