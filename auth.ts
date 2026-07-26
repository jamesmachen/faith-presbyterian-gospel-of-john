import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import PostgresAdapter from "@auth/pg-adapter";
import { authPool, recordSuccessfulSignIn } from "@/db/auth-pool";
import { withBasePath } from "@/lib/base-path";

const resendKey = process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(authPool),
  basePath: withBasePath("/api/auth"),
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  providers: [
    Resend({
      apiKey: resendKey,
      from: process.env.EMAIL_FROM,
      maxAge: 15 * 60,
    }),
  ],
  pages: {
    signIn: withBasePath("/admin/signin"),
    verifyRequest: withBasePath("/admin/verify"),
    error: withBasePath("/admin/signin"),
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
