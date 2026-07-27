"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";

export default function PdfResourcePreview({ url, zoom }: { url: string; zoom: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [status, setStatus] = useState("Loading PDF…");
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    async function load() {
      try {
        setError("");
        setStatus("Loading PDF…");
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const response = await fetch(url);
        if (!response.ok) throw new Error(`The PDF could not be loaded (${response.status}).`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        loadingTask = pdfjs.getDocument({ data: bytes });
        const loadedDocument = await loadingTask.promise;
        if (disposed) {
          await loadingTask.destroy();
          return;
        }
        setDocument(loadedDocument);
        setPageNumber(1);
        setStatus("");
      } catch (loadError) {
        if (!disposed) {
          setStatus("");
          setError(loadError instanceof Error ? loadError.message : "The PDF preview could not be rendered.");
        }
      }
    }

    void load();
    return () => {
      disposed = true;
      if (loadingTask) void loadingTask.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (!document || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    async function renderPage() {
      try {
        setStatus(`Rendering page ${pageNumber}…`);
        const page = await document!.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;
        const viewport = page.getViewport({ scale: 1.25 * zoom });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas rendering is unavailable.");
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        });
        await renderTask.promise;
        if (!cancelled) setStatus("");
      } catch (renderError) {
        if (!cancelled && (renderError as { name?: string })?.name !== "RenderingCancelledException") {
          setStatus("");
          setError(renderError instanceof Error ? renderError.message : "This PDF page could not be rendered.");
        }
      }
    }

    void renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber, zoom]);

  if (error) return <div className="resource-viewer-fallback" role="alert"><strong>PDF preview unavailable</strong><p>{error}</p></div>;

  return (
    <div className="pdf-preview">
      {document && <div className="pdf-page-controls" aria-label="PDF page controls">
        <button type="button" onClick={() => setPageNumber((page) => Math.max(1, page - 1))} disabled={pageNumber <= 1}>Previous</button>
        <span>Page {pageNumber} of {document.numPages}</span>
        <button type="button" onClick={() => setPageNumber((page) => Math.min(document.numPages, page + 1))} disabled={pageNumber >= document.numPages}>Next</button>
      </div>}
      {status && <p className="resource-viewer-loading" role="status">{status}</p>}
      <div className="pdf-canvas-wrap"><canvas ref={canvasRef} aria-label={`PDF page ${pageNumber}`} /></div>
    </div>
  );
}
