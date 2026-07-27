# Faith Presbyterian Church — Gospel of John

Native Next.js application for Faith Presbyterian Church Sunday School,
deployed at `https://silasfaithpres.org/sunday-school`.

## Local development

Requires Node.js 22.13 or newer and the variables shown in `.env.example`.

```bash
npm install
npm run dev
```

Production validation:

```bash
npm run build
npm test
npm start
```

## Passwordless administrator authentication

The administrator area uses Auth.js database sessions and Resend email magic
links. Auth.js stores hashed, single-use verification tokens with expiration
times and issues secure HTTP-only session cookies after verification. Every
administrator page and mutation API validates the server-side session and the
`site_users` allowlist.

The permanent owner is configured with `OWNER_ADMIN_EMAIL`. Production must set
this to `jamesmachen@gmail.com`. The application upserts that address as an
active owner during initialization and refuses to disable, remove, or demote
it. Additional administrators can be invited, re-invited, disabled, enabled, or
removed from the Admin interface. Adding an email only updates the allowlist;
the person must prove control of the address through their own magic link.

Required server-side variables:

- `AUTH_SECRET` — a long random value generated with `openssl rand -base64 32`.
- `AUTH_URL` — the production origin only: `https://silasfaithpres.org`.
- `OWNER_ADMIN_EMAIL` — `jamesmachen@gmail.com`.
- `RESEND_API_KEY` — the Resend sending API key created by the Vercel Resend
  integration. `AUTH_RESEND_KEY` remains supported as a fallback.
- `EMAIL_FROM` — a sender on a verified Resend domain, for example
  `Faith Presbyterian Sunday School <sunday-school@auth.silasfaithpres.org>`.
- `DATABASE_URL` — a pooled Postgres connection string.
- `BLOB_READ_WRITE_TOKEN` — the connected Vercel Blob token.

Do not prefix any of these variables with `NEXT_PUBLIC_`.

Auth.js endpoints are served below:

`https://silasfaithpres.org/sunday-school/api/auth/*`

Internally, Next.js removes its `/sunday-school` base path before calling the
route handler, so Auth.js is configured with `/api/auth`. The application adds
the public base path exactly once when it constructs the emailed callback URL.
After Resend accepts an email, the server action sends the browser directly to:

`https://silasfaithpres.org/sunday-school/admin/verify`

Server Action redirects use application-relative `/admin/*` paths because
Next.js adds its configured base path to redirect responses.

The emailed callback returns through the public Auth.js endpoint and then
redirects to:

`https://silasfaithpres.org/sunday-school/admin`

## Resend setup

1. Add and verify a sending domain or subdomain in Resend.
2. Publish the DNS records Resend supplies.
3. Connect the Vercel Resend integration or create a sending API key. Use
   `RESEND_API_KEY` for the integration-created variable; `AUTH_RESEND_KEY` is
   also accepted.
4. Set `EMAIL_FROM` to an address on the verified domain.
5. Disable link rewriting/tracking for authentication mail so single-use links
   are not altered.

The sign-in form intentionally shows the same confirmation regardless of
whether an address is allowlisted.

## Database migration

Run `db/migrations/001_passwordless_auth.sql` once against the production
Postgres database before enabling authentication. It:

- creates the Auth.js users, accounts, sessions, and verification-token tables;
- adds display name, active status, and last-sign-in fields to `site_users`;
- preserves existing administrator rows; and
- upserts `jamesmachen@gmail.com` as the protected owner.

The application also performs equivalent idempotent initialization on first
use. The explicit migration is recommended so deployment health does not depend
on runtime DDL permissions.

## Vercel deployment

1. Import the GitHub repository as a Next.js project.
2. Connect Postgres and Blob resources.
3. add all required environment variables to Production and Preview as needed.
4. Assign `silasfaithpres.org` to the project.
5. Run the migration.
6. Deploy and test sign-in from `/sunday-school/admin`.

The canonical application path is `/sunday-school`; `/sundayschool` permanently
redirects there.
