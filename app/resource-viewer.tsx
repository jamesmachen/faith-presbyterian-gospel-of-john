"use client";

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

const PdfResourcePreview = lazy(() => import("./pdf-resource-preview"));
const DocxResourcePreview = lazy(() => import("./docx-resource-preview"));

export type ViewableResource = {
  title: string;
  filename: string;
  url: string;
};

type PreviewKind = "pdf" | "docx" | "image" | "unsupported";

function previewKind(filename: string): PreviewKind {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "pdf";
  if (extension === "docx") return "docx";
  if (extension && ["png", "jpg", "jpeg", "webp"].includes(extension)) return "image";
  return "unsupported";
}

export default function ResourceViewer({
  resource,
  onClose,
}: {
  resource: ViewableResource;
  onClose: () => void;
}) {
  const shellRef = useRef<HTMLElement>(null);
  const kind = useMemo(() => previewKind(resource.filename), [resource.filename]);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape" && !document.fullscreenElement) onClose();
    }
    function handleFullscreen() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("fullscreenchange", handleFullscreen);
    };
  }, [onClose]);

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (shellRef.current?.requestFullscreen) {
      await shellRef.current.requestFullscreen();
    }
  }

  const supportsZoom = kind === "pdf" || kind === "image";

  return (
    <div className="resource-viewer-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={shellRef}
        className="resource-viewer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resource-viewer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="resource-viewer-header">
          <div>
            <p className="eyebrow">Resource viewer</p>
            <h2 id="resource-viewer-title">{resource.title || resource.filename}</h2>
            <small>{resource.filename}</small>
          </div>
          <button type="button" className="resource-viewer-close" onClick={onClose} aria-label="Close resource viewer">×</button>
        </header>
        <div className="resource-viewer-toolbar" aria-label="Viewer controls">
          {supportsZoom && <>
            <button type="button" onClick={() => setZoom((value) => Math.max(.5, Number((value - .25).toFixed(2))))} aria-label="Zoom out">−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((value) => Math.min(3, Number((value + .25).toFixed(2))))} aria-label="Zoom in">+</button>
            <button type="button" onClick={() => setZoom(1)}>Reset zoom</button>
          </>}
          <button type="button" onClick={() => void toggleFullscreen()}>{isFullscreen ? "Exit full screen" : "Full screen"}</button>
          <a href={resource.url} download={resource.filename}>Download Original</a>
        </div>
        <div className="resource-viewer-stage">
          <Suspense fallback={<p className="resource-viewer-loading" role="status">Loading viewer…</p>}>
            {kind === "pdf" && <PdfResourcePreview url={resource.url} zoom={zoom} />}
            {kind === "docx" && <DocxResourcePreview url={resource.url} />}
            {kind === "image" && <div className="image-preview">
              <button type="button" onClick={() => setZoom((value) => value === 1 ? 2 : 1)} aria-label={zoom === 1 ? "Enlarge image" : "Reset image size"}>
                <img src={resource.url} alt={resource.title || resource.filename} style={{ transform: `scale(${zoom})` }} />
              </button>
              <p>Tap or click the image to {zoom === 1 ? "enlarge" : "reset"} it.</p>
            </div>}
            {kind === "unsupported" && <div className="resource-viewer-fallback" role="status">
              <strong>Preview unavailable</strong>
              <p>This file type cannot be displayed in the browser. You can still download the original file.</p>
              <a className="button button-primary" href={resource.url} download={resource.filename}>Download Original</a>
            </div>}
          </Suspense>
        </div>
      </section>
    </div>
  );
}

