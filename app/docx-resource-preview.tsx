"use client";

import { useEffect, useRef, useState } from "react";

export default function DocxResourcePreview({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Loading Word document…");
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;

    async function renderDocument() {
      try {
        setError("");
        setStatus("Loading Word document…");
        const response = await fetch(url);
        if (!response.ok) throw new Error(`The Word document could not be loaded (${response.status}).`);
        const data = await response.arrayBuffer();
        const { renderAsync } = await import("docx-preview");
        if (disposed || !containerRef.current) return;
        containerRef.current.replaceChildren();
        setStatus("Rendering Word document…");
        await renderAsync(data, containerRef.current, containerRef.current, {
          breakPages: true,
          ignoreWidth: false,
          ignoreHeight: false,
          useBase64URL: true,
          renderAltChunks: false,
        });
        if (!disposed) setStatus("");
      } catch (renderError) {
        if (!disposed) {
          setStatus("");
          setError(renderError instanceof Error ? renderError.message : "The Word preview could not be rendered.");
        }
      }
    }

    void renderDocument();
    return () => {
      disposed = true;
      containerRef.current?.replaceChildren();
    };
  }, [url]);

  if (error) return <div className="resource-viewer-fallback" role="alert"><strong>Word preview unavailable</strong><p>{error}</p></div>;

  return (
    <div className="docx-preview-shell">
      {status && <p className="resource-viewer-loading" role="status">{status}</p>}
      <div ref={containerRef} className="docx-preview-content" aria-label="Word document preview" />
    </div>
  );
}
