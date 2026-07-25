import AdminPanel from "../admin-panel";
import DocumentStore from "../document-store";
import ImageStore from "../image-store";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { getSiteRole } from "@/db/access";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  const role = await getSiteRole(user.email);

  if (role !== "admin") {
    return (
      <main className="access-page">
        <section className="access-card">
          <img src="/fpc-logo.png" alt="Faith Presbyterian Church" />
          <p className="eyebrow">Administrator access</p>
          <h1>This account is not an administrator.</h1>
          <p>You are signed in as <strong>{user.email}</strong>.</p>
          <a className="button button-primary" href="/">Return to the class site</a>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Faith Presbyterian Church Sunday School home">
          <img className="brand-logo" src="/fpc-logo.png" alt="Faith Presbyterian Church" />
          <small>Sunday School</small>
        </a>
        <div className="header-tools">
          <nav aria-label="Administrator navigation"><a href="/">Class site</a><a href="#passages">Passages</a><a href="#resources">Files</a></nav>
          <div className="account-menu"><span>Administrator</span><a href={chatGPTSignOutPath("/")}>Sign out</a></div>
        </div>
      </header>

      <section className="admin-page-hero">
        <div className="section-shell">
          <p className="eyebrow">Administrator area</p>
          <h1>Site settings & resources</h1>
          <p>Update the passage tiles, Bible resources, class files, images, and administrator list.</p>
        </div>
      </section>

      <AdminPanel currentEmail={user.email} />

      <section className="admin-resource-section section-shell" id="resources">
        <div className="section-heading solo">
          <p className="eyebrow">Resource stores</p>
          <h2>Documents & images</h2>
          <p className="admin-intro">Upload or delete class materials here. Visitors only see the downloadable items on the main site.</p>
        </div>
        <div className="resource-grid">
          <details className="resource-card" open>
            <summary><span className="resource-icon">D</span><span><strong>Documents</strong><small>Upload and manage class files</small></span><b aria-hidden="true">+</b></summary>
            <DocumentStore isAdmin />
          </details>
          <details className="resource-card" open>
            <summary><span className="resource-icon">I</span><span><strong>Images</strong><small>Upload and manage class artwork</small></span><b aria-hidden="true">+</b></summary>
            <ImageStore isAdmin />
          </details>
        </div>
      </section>

      <footer>
        <div><strong>Faith Presbyterian Church</strong><span>Sunday School · Administration</span></div>
        <a href="/">Return to class site →</a>
      </footer>
    </main>
  );
}
