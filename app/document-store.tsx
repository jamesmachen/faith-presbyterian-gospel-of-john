"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { withBasePath } from "@/lib/base-path";
import AssetEditModal from "./asset-edit-modal";
import ResourceViewer from "./resource-viewer";

type StoredDocument = {
  key: string;
  name: string;
  filename: string;
  displayText: string;
  size: number;
  uploaded: string;
};

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ".pdf,.docx,.txt,.md,.rtf,.ppt,.pptx,.xls,.xlsx";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export default function DocumentStore({ isAdmin }: { isAdmin: boolean }) {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayText, setDisplayText] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingDisplayText, setEditingDisplayText] = useState("");
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editingDocument = documents.find((document) => document.key === editingKey) ?? null;
  const viewingDocument = documents.find((document) => document.key === viewingKey) ?? null;

  const loadDocuments = useCallback(async () => {
    try {
      const response = await fetch(withBasePath("/api/documents"), { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load class materials.");
      const data = (await response.json()) as { documents: StoredDocument[] };
      setDocuments(data.documents);
    } catch {
      setStatus("Class materials are temporarily unavailable.");
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setDisplayText(file?.name ?? "");
    setStatus(file ? `${file.name} is ready to upload.` : "");
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) return setStatus("Choose a class material file first.");
    if (selectedFile.name.toLowerCase().endsWith(".doc")) return setStatus("Legacy .doc files are not supported. Convert this file to .docx or PDF before uploading.");
    if (!displayText.trim()) return setStatus("Display text is required.");
    if (selectedFile.size > MAX_FILE_SIZE) return setStatus("Please choose a file smaller than 15 MB.");

    setIsUploading(true);
    setStatus(`Uploading ${selectedFile.name}…`);
    const formData = new FormData();
    formData.set("file", selectedFile);
    formData.set("displayText", displayText);

    try {
      const response = await fetch(withBasePath("/api/documents"), { method: "POST", body: formData });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      setSelectedFile(null);
      setDisplayText("");
      if (inputRef.current) inputRef.current.value = "";
      setStatus("Class material uploaded successfully.");
      await loadDocuments();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  async function updateDisplayText(document: StoredDocument) {
    const nextDisplayText = editingDisplayText.trim();
    if (!nextDisplayText) return setStatus("Display text is required.");
    setStatus(`Updating ${document.filename}…`);
    try {
      const response = await fetch(withBasePath("/api/documents"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: document.key, displayText: nextDisplayText }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Update failed.");
      setEditingKey(null);
      setEditingDisplayText("");
      setStatus("Class material display text updated.");
      await loadDocuments();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Update failed. Please try again.");
    }
  }

  async function deleteDocument(document: StoredDocument) {
    if (!window.confirm(`Delete ${document.filename}? This cannot be undone.`)) return;
    setStatus(`Deleting ${document.filename}…`);
    try {
      const response = await fetch(withBasePath(`/api/documents?key=${encodeURIComponent(document.key)}`), { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Delete failed.");
      setStatus("Class material deleted.");
      await loadDocuments();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed. Please try again.");
    }
  }

  return (
    <div className="document-store">
      <ul className="download-list">
        <li><a href={withBasePath("/resources/gospel-of-john-study-guide.md")} download><span>Gospel of John Study Guide</span><small>Markdown document · 4 KB</small></a></li>
        <li><a href={withBasePath("/resources/class-schedule.md")} download><span>Weeks 10–21 Schedule</span><small>Markdown document · 2 KB</small></a></li>
        {documents.map((document) => (
          <li key={document.key} className="uploaded-document">
            <button type="button" className="resource-view-trigger" onClick={() => setViewingKey(document.key)} aria-label={`View ${document.displayText}`}>
              <span>{document.displayText}</span>
              <small>{isAdmin ? `Filename: ${document.filename} · ` : ""}Uploaded class material · {formatSize(document.size)}</small>
            </button>
            <div className="asset-row-actions">
              <a className="resource-download-action" href={withBasePath(`/api/documents?key=${encodeURIComponent(document.key)}`)} download={document.filename}>Download Original</a>
              {isAdmin && <>
              <button type="button" className="edit-button" onClick={() => { setEditingKey(document.key); setEditingDisplayText(document.displayText); }}>Edit text</button>
              <button type="button" className="document-delete" onClick={() => void deleteDocument(document)} aria-label={`Delete ${document.filename}`}>Delete</button>
              </>}
            </div>
          </li>
        ))}
      </ul>
      {isAdmin && editingDocument && <AssetEditModal
        title="Class Material"
        filename={editingDocument.filename}
        value={editingDisplayText}
        onChange={setEditingDisplayText}
        onCancel={() => setEditingKey(null)}
        onSubmit={(event) => { event.preventDefault(); void updateDisplayText(editingDocument); }}
      />}
      {viewingDocument && <ResourceViewer
        resource={{
          title: viewingDocument.displayText || viewingDocument.filename,
          filename: viewingDocument.filename,
          url: withBasePath(`/api/documents?key=${encodeURIComponent(viewingDocument.key)}`),
        }}
        onClose={() => setViewingKey(null)}
      />}
      {isAdmin && <form className="upload-panel" onSubmit={uploadDocument}>
        <div><strong>Add class material</strong><small>PDF, Word, text, presentation, or spreadsheet · up to 15 MB</small></div>
        <label className="asset-display-field"><span>Display text</span><input type="text" value={displayText} onChange={(event) => setDisplayText(event.target.value)} maxLength={160} placeholder="Text shown in the Class Materials list" required /></label>
        <label className="file-picker"><span>{selectedFile ? "Choose another" : "Choose file"}</span><input ref={inputRef} type="file" name="file" accept={ACCEPTED_EXTENSIONS} onChange={chooseFile} /></label>
        <button type="submit" disabled={!selectedFile || !displayText.trim() || isUploading}>{isUploading ? "Uploading…" : "Upload"}</button>
        <p className="upload-status" role="status" aria-live="polite">{status}</p>
      </form>}
      {!isAdmin && <p className="visitor-note">Class materials are available to everyone. Administrators manage uploads.</p>}
    </div>
  );
}
