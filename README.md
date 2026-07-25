# Faith Presbyterian Church — Gospel of John

Native Next.js application for Faith Presbyterian Church Sunday School
resources, study schedules, documents, images, Bible translations, and site
administration.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Production validation:

```bash
npm run build
npm start
```

## Vercel configuration

Import this GitHub repository into Vercel as a Next.js project. No framework
adapter or custom build command is required.

The application uses these server-side environment variables:

- `DATABASE_URL` — a pooled Postgres connection string from a Vercel
  Marketplace Postgres provider such as Neon or Supabase.
- `BLOB_READ_WRITE_TOKEN` — created when a Vercel Blob store is connected to
  the project.

The application creates its Postgres tables and initial records on first use.
Existing Cloudflare D1 data and R2 objects are not automatically transferred;
export and import those records and files before switching production traffic.

## Authentication

The current administrator flow trusts the request headers
`oai-authenticated-user-email`, `oai-authenticated-user-full-name`, and
`oai-authenticated-user-full-name-encoding`. Those headers were supplied by the
previous Sites authentication gateway. Vercel does not provide them.

Before enabling administration on Vercel, connect an identity provider (for
example Auth.js, Clerk, or another trusted authentication layer) and update the
server-side identity lookup to use that provider. Never accept these identity
headers directly from untrusted public requests.

The public site remains readable, but the database and Blob environment
variables are required for schedules, Bible translations, uploaded resources,
and administrator data.
