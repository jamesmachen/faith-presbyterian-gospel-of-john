import postgres from "postgres";

let client: ReturnType<typeof postgres> | undefined;

export function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Database storage is not configured. Connect a Postgres integration in Vercel and provide DATABASE_URL.",
    );
  }

  client ??= postgres(connectionString, {
    max: 1,
    prepare: false,
  });

  return client;
}
