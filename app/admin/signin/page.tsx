import { signIn } from "@/auth";
import { HOME_PATH, withBasePath } from "@/lib/base-path";
import { isSuccessfulEmailSignInResult } from "@/lib/auth-routing";
import { redirect } from "next/navigation";

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function requestMagicLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    let result: string | undefined;
    try {
      result = await signIn("resend", {
        email,
        redirect: false,
        redirectTo: withBasePath("/admin"),
      });
    } catch {
      redirect("/admin/signin?error=EmailSignin");
    }
    redirect(
      isSuccessfulEmailSignInResult(result)
        ? "/admin/verify"
        : "/admin/signin?error=EmailSignin",
    );
  }

  return (
    <main className="access-page">
      <section className="access-card">
        <img src={withBasePath("/fpc-logo.png")} alt="Faith Presbyterian Church" />
        <p className="eyebrow">Administrator access</p>
        <h1>Sign in by email</h1>
        <p>Enter your email address and we will send a secure, single-use sign-in link.</p>
        <form action={requestMagicLink} className="add-user-form">
          <label>
            <span>Email address</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <button className="button button-primary" type="submit">
            Email me a sign-in link
          </button>
        </form>
        {error && <p className="admin-status">The sign-in link could not be sent. Please try again.</p>}
        <a href={withBasePath(HOME_PATH)}>Return to the class site</a>
      </section>
    </main>
  );
}
