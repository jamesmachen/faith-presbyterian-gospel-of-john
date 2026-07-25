import DocumentStore from "./document-store";
import ImageStore from "./image-store";
import TranslationStore from "./translation-store";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";
import { getSiteRole } from "@/db/access";
import { listStudyPassages } from "@/db/site-config";
import { withBasePath } from "@/lib/base-path";
import { DEFAULT_STUDY_PASSAGES } from "./site-config";

export const dynamic = "force-dynamic";

const discussionQuestions = [
  "What is the key word or phrase in the passage? Why did you select it?",
  "How does the passage expand your knowledge of Jesus as your Savior? What does the passage reveal about you?",
  "Why do you think this passage is included as part of the good news John the Evangelist proclaimed? Does the passage challenge the world’s wisdom?",
  "How does the passage reflect the Old and New Testament story? Can you identify any passages in the Old Testament which are a shadow of this passage?",
  "Is there good news in this story? If so, how would you use this passage to tell a non-believer about the impact the Gospel has had in your life?",
];

export default async function Home() {
  const user = await getChatGPTUser();
  const role = user ? await getSiteRole(user.email) : null;
  const isAdmin = role === "admin";
  const schedule = await listStudyPassages().catch(() => DEFAULT_STUDY_PASSAGES);
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Faith Presbyterian Church Sunday School home">
          <img className="brand-logo" src={withBasePath("/fpc-logo.png")} alt="Faith Presbyterian Church" />
          <small>Sunday School</small>
        </a>
        <div className="header-tools">
          <nav aria-label="Primary navigation">
            <a href="#resources">Resources</a>
            <a href="#schedule">Schedule</a>
            <a href="#study">Study Guide</a>
            {isAdmin && <a href={withBasePath("/admin")}>ADMIN</a>}
          </nav>
          <div className="account-menu">
            {isAdmin ? <><span>Administrator</span><a href={chatGPTSignOutPath("/")}>Sign out</a></> : user ? <><span>Not an admin</span><a href={chatGPTSignOutPath("/")}>Sign out</a></> : <a href={chatGPTSignInPath("/admin")}>Admin sign in</a>}
          </div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">A study for ordinary disciples</p>
          <h1>The Gospel of John</h1>
          <p className="lede">Come and see the good news of Jesus—and practice sharing it with the people God has placed in your life.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#schedule">View the study schedule</a>
            <a className="button button-secondary" href="#resources">Browse resources</a>
          </div>
        </div>
        <aside className="scripture-card" aria-label="John 1:39 — Come and see">
          <span className="chapter-number">The invitation</span>
          <blockquote className="scripture-quote">
            <p>“Come,” he replied,</p>
            <p><em>“and you will see.”</em></p>
            <cite>John 1:39</cite>
          </blockquote>
          <div className="quote-rule" aria-hidden="true"><i></i></div>
        </aside>
      </section>

      <section className="resources-section section-shell" id="resources">
        <div className="section-heading solo">
          <div><p className="eyebrow">Student library</p><h2>Everything for the week ahead</h2></div>
        </div>
        <div className="resource-grid">
          <TranslationStore />
          <details className="resource-card" open>
            <summary><span className="resource-icon">D</span><span><strong>Documents</strong><small>Study guides & worksheets</small></span><b aria-hidden="true">+</b></summary>
            <DocumentStore isAdmin={false} />
          </details>
          <details className="resource-card">
            <summary><span className="resource-icon">I</span><span><strong>Images</strong><small>Class artwork & sharing graphics</small></span><b aria-hidden="true">+</b></summary>
            <ImageStore isAdmin={false} />
          </details>
        </div>
      </section>

      <section className="schedule-section" id="schedule">
        <div className="section-shell">
          <div className="section-heading light">
            <div><p className="eyebrow">Weeks 10–21</p><h2>Passages for study</h2></div>
            <p>Read the passage before class in more than one translation. Then try writing it in your own words.</p>
          </div>
          <ol className="schedule-grid">
            {schedule.map((item) => (
              <li key={item.id}>
                <span>{item.weekLabel}</span><strong>{item.scriptureLabel}</strong><small>{item.descriptionLabel}</small>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="study-section section-shell" id="study">
        <aside className="goal-card">
          <p className="eyebrow">Our purpose</p>
          <h2>Good news for you—and for the world.</h2>
          <div className="goal-block"><span>Goal</span><p>To answer: “What makes the Gospel of John good news for you and for the world? And if it is good news, how can you share it with those God has put in your life?”</p></div>
          <div className="goal-block"><span>Method</span><p>To explore the Book of John through a series of questions, deepen our knowledge of the Gospel, and practice ways to share it with those God places in our lives.</p></div>
        </aside>

        <div className="study-content">
          <article>
            <p className="eyebrow terracotta">For reflection</p>
            <h2>A Gospel Challenge</h2>
            <div className="reflection-list">
              <p><span>01</span>The Bible says God called his creation good and humans very good. What does that mean to you?</p>
              <p><span>02</span>Sin is the cause of brokenness. What methods do you see being used to fix sin and brokenness in the world? Why do these methods never work?</p>
              <p><span>03</span>God provides the only way to solve the sin problem and fix brokenness: repent and believe the Gospel.</p>
              <p><span>04</span>What is the essence of the Gospel message? Can you summarize the Gospel in your own words?</p>
              <p><span>05</span>What is the most unbelievable thing about the Gospel?</p>
              <p><span>06</span>What can one expect from a life following Jesus? How would you tell your story to a friend?</p>
            </div>
          </article>

          <article className="outline-article">
            <p className="eyebrow">A rhythm for every gathering</p>
            <h2>Class Outline</h2>
            <ol className="class-steps">
              <li><span>1</span><div><strong>Opening Prayer</strong><p>Quiet our hearts and ask the Spirit to guide our study.</p></div></li>
              <li><span>2</span><div><strong>Read Together</strong><p>Read the passage for the day from multiple translations.</p></div></li>
              <li><span>3</span><div><strong>Tell It Again</strong><p>Students share the passage written in their own words.</p></div></li>
              <li><span>4</span><div><strong>Ask & Explore</strong><p>Use the questions below to listen closely and respond faithfully.</p></div></li>
            </ol>
            <div className="questions">
              {discussionQuestions.map((question, index) => (
                <details key={question}>
                  <summary><span>{String(index + 1).padStart(2, "0")}</span>{question}</summary>
                  {index === 4 && <div className="witness-list"><p>For further reflection, how would you use this passage to witness to:</p><ul><li>A fellow believer who is having a difficult time?</li><li>A curious skeptic who doesn’t know the Bible?</li><li>A serious seeker who is actively seeking answers to life’s questions?</li></ul></div>}
                </details>
              ))}
            </div>
          </article>
        </div>
      </section>

      <footer>
        <div><strong>Faith Presbyterian Church</strong><span>Sunday School · The Gospel of John</span></div>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
