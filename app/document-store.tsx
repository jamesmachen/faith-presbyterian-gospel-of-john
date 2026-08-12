"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
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
  const [isViewingStudyGuide, setIsViewingStudyGuide] = useState(false);
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
    if (!displayText.trim()) return setStatus("Display text is required.");

    setIsUploading(true);
    setStatus(`Preparing ${selectedFile.name} for upload…`);

    try {
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").slice(0, 150) || "document";
      const key = `documents/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const blob = await upload(key, selectedFile, {
        access: "public",
        handleUploadUrl: withBasePath("/api/documents"),
        multipart: true,
        clientPayload: JSON.stringify({ filename: safeName }),
        onUploadProgress: ({ percentage }) => {
          setStatus(`Uploading ${selectedFile.name}… ${Math.round(percentage)}%`);
        },
      });
      const response = await fetch(withBasePath("/api/documents"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: blob.pathname, filename: safeName, displayText }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "The file uploaded, but its details could not be saved.");
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
        <li className="uploaded-document">
          <button type="button" className="resource-view-trigger" onClick={() => setIsViewingStudyGuide(true)} aria-label="View Class Study Guide - John">
            <span>Class Study Guide - John</span>
            <small>Word document · 15.8 KB</small>
          </button>
        </li>
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
      {isViewingStudyGuide && <ResourceViewer
        resource={{
          title: "Class Study Guide - John",
          filename: "Class Study Guide - John.docx",
          url: withBasePath("/resources/class-study-guide-john.docx"),
        }}
        onClose={() => setIsViewingStudyGuide(false)}
      />}
      {isAdmin && <form className="upload-panel" onSubmit={uploadDocument}>
        <div><strong>Add class material</strong><small>Any file type · large files upload directly and securely</small></div>
        <label className="asset-display-field"><span>Display text</span><input type="text" value={displayText} onChange={(event) => setDisplayText(event.target.value)} maxLength={160} placeholder="Text shown in the Class Materials list" required /></label>
        <label className="file-picker"><span>{selectedFile ? "Choose another" : "Choose file"}</span><input ref={inputRef} type="file" name="file" onChange={chooseFile} /></label>
        <button type="submit" disabled={!selectedFile || !displayText.trim() || isUploading}>{isUploading ? "Uploading…" : "Upload"}</button>
        <p className="upload-status" role="status" aria-live="polite">{status}</p>
      </form>}
      {!isAdmin && <p className="visitor-note">Class materials are available to everyone. Administrators manage uploads.</p>}
    </div>
  );
}
