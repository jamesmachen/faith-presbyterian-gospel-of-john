import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/auth";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withBasePath } from "@/lib/base-path";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sunday School | Faith Presbyterian Church",
  description: "Sunday School classes, Bible studies, schedules, study materials, and resources from Faith Presbyterian Church.",
  alternates: { canonical: withBasePath("/") },
  openGraph: { title: "Faith Presbyterian Church Sunday School", description: "Bible study, class resources, schedules, and materials from Faith Presbyterian Church Sunday School.", type: "website", url: withBasePath("/") },
};

type SundaySchoolClass = { slug: string; title: string; tagline?: string; description: string; image?: string; status: "current" | "upcoming" | "archive" };

const classes: SundaySchoolClass[] = [{
  slug: "john",
  title: "The Gospel of John",
  tagline: "Come and See",
  description: "Explore John's witness to Jesus Christ and consider how the good news shapes our lives and our witness to the world.",
  image: "/resources/gospel-of-john-class-cover.png",
  status: "current",
}];

export default async function SundaySchoolLandingPage() {
  const admin = await getAuthenticatedAdmin();
  return <main className="landing-page">
    <header className="site-header landing-header">
      <Link className="brand" href="/" aria-label="Faith Presbyterian Church Sunday School home"><img className="brand-logo" src={withBasePath("/fpc-logo.png")} alt="Faith Presbyterian Church" /><small>Sunday School</small></Link>
      <div className="header-tools"><nav aria-label="Primary navigation"><a href="#classes">Classes</a><Link href="/admin">ADMIN</Link></nav><div className="account-menu">{admin ? <><span>{admin.displayName || admin.email}</span><form action={async () => { "use server"; await signOut({ redirectTo: withBasePath("/") }); }}><button type="submit">Sign out</button></form></> : <Link href="/admin/signin">Admin sign in</Link>}</div></div>
    </header>
    <section className="landing-hero">
      <div className="landing-hero-copy"><p className="eyebrow">Faith Presbyterian Church</p><h1>Sunday School</h1><p className="lede">Growing together in the knowledge of Christ through Scripture, conversation, and faithful discipleship.</p><a className="button button-primary" href="#classes">Explore current classes</a></div>
      <aside className="scripture-card landing-scripture" aria-label="Psalm 86 verse 11"><span className="chapter-number">A prayer for learning</span><blockquote className="scripture-quote"><p>“Teach me your way, O LORD,</p><p><em>that I may walk in your truth.”</em></p><cite>Psalm 86:11</cite></blockquote><div className="quote-rule" aria-hidden="true"><i /></div></aside>
    </section>
    <section className="landing-classes section-shell" id="classes" aria-labelledby="classes-title">
      <div className="landing-section-heading"><p className="eyebrow">Current studies</p><h2 id="classes-title">Sunday School Classes</h2><p>Choose a class to view its schedule, study materials, resources, and weekly content.</p></div>
      <div className="class-card-grid">{classes.map((classItem) => <article className="class-card" key={classItem.slug}>{classItem.image && <div className="class-card-image"><img src={withBasePath(classItem.image)} alt="The Gospel of John class cover" /></div>}<div className="class-card-copy"><p className="eyebrow">{classItem.status === "current" ? "Current study" : classItem.status}</p><h3>{classItem.title}</h3>{classItem.tagline && <p className="class-tagline">{classItem.tagline}</p>}<p>{classItem.description}</p><small>Study schedule · Resources · Class guide</small><Link className="button button-primary class-card-action" href={`/${classItem.slug}`}>Enter the class <span aria-hidden="true">→</span></Link></div></article>)}</div>
    </section>
    <footer className="landing-footer"><div><strong>Faith Presbyterian Church</strong><span>Sunday School</span></div><p>Growing in grace and in the knowledge of our Lord and Savior Jesus Christ.</p></footer>
  </main>;
}
