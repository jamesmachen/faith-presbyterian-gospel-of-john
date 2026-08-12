import { HOME_PATH, withBasePath } from "@/lib/base-path";

export default function VerifyRequestPage() {
  return (
    <main className="access-page">
      <section className="access-card">
        <img src={withBasePath("/fpc-logo.png")} alt="Faith Presbyterian Church" />
        <p className="eyebrow">Check your email</p>
        <h1>Your secure sign-in link is on its way.</h1>
        <p>If the address can receive email, a time-limited link will arrive shortly.</p>
        <a className="button button-primary" href={withBasePath(HOME_PATH)}>Return to the class site</a>
      </section>
    </main>
  );
}
