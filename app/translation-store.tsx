"use client";

import { useCallback, useEffect, useState } from "react";

type BibleTranslation = {
  id: string;
  name: string;
  abbreviation: string;
  url: string;
  iconKey: string | null;
};

export default function TranslationStore() {
  const [translations, setTranslations] = useState<BibleTranslation[]>([]);
  const [status, setStatus] = useState("Loading Bible resources…");

  const loadTranslations = useCallback(async () => {
    try {
      const response = await fetch("/api/translations", { cache: "no-store" });
      const result = (await response.json()) as { translations?: BibleTranslation[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not load translations.");
      setTranslations(result.translations ?? []);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Bible resources are temporarily unavailable.");
    }
  }, []);

  useEffect(() => {
    void loadTranslations();
    const refresh = () => void loadTranslations();
    window.addEventListener("translations-updated", refresh);
    return () => window.removeEventListener("translations-updated", refresh);
  }, [loadTranslations]);

  return (
    <details className="resource-card translation-card" open>
      <summary>
        <span className="resource-icon bible-icon" aria-hidden="true"><img src="/bible-generic-icon.png" alt="" /></span>
        <span><strong>Bible Resources</strong><small>Read John in multiple versions</small></span>
        <b aria-hidden="true">+</b>
      </summary>
      {status && <p className="visitor-note" role="status">{status}</p>}
      <div className="translation-list">
        {translations.map((translation) => (
          <a key={translation.id} className="translation-link" href={translation.url} target="_blank" rel="noopener noreferrer" aria-label={`Read John in the ${translation.name} (opens in a new tab)`}>
            <span className={`translation-mark${translation.iconKey ? " has-image" : ""}`} aria-hidden="true">
              {translation.iconKey ? <img src={`/api/translations?iconKey=${encodeURIComponent(translation.iconKey)}`} alt="" /> : translation.abbreviation}
            </span>
            <span className="translation-copy"><strong>{translation.abbreviation}</strong><small>{translation.name}</small></span>
            <span className="translation-arrow" aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
    </details>
  );
}
