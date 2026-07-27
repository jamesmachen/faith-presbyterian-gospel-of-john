import NextAuth from "next-auth";
import PostgresAdapter from "@auth/pg-adapter";
import { authPool, recordSuccessfulSignIn } from "@/db/auth-pool";
import { AUTH_INTERNAL_BASE_PATH } from "@/lib/auth-routing";
import { safeAuthError } from "@/lib/auth-logging";
import { createResendProvider } from "@/lib/resend-provider";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(authPool),
  basePath: AUTH_INTERNAL_BASE_PATH,
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  providers: [createResendProvider()],
  pages: {
    signIn: "/admin/signin",
    verifyRequest: "/admin/verify",
    error: "/admin/signin",
  },
  logger: {
    error(error) {
      console.error(`[auth] ${JSON.stringify({ event: "error", ...safeAuthError(error) })}`);
    },
    warn(code) {
      console.warn(`[auth] ${JSON.stringify({ event: "warning", code })}`);
    },
    debug() {},
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.email = user.email;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.email) await recordSuccessfulSignIn(user.email, user.name);
    },
  },
  trustHost: true,
});
