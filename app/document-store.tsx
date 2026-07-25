"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";

type StoredDocument = {
  key: string;
  name: string;
  size: number;
  uploaded: string;
};

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.txt,.md,.rtf,.ppt,.pptx,.xls,.xlsx";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentStore({ isAdmin }: { isAdmin: boolean }) {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load uploaded documents.");
      const data = (await response.json()) as { documents: StoredDocument[] };
      setDocuments(data.documents);
    } catch {
      setStatus("Uploaded documents are temporarily unavailable.");
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setStatus(file ? `${file.name} is ready to upload.` : "");
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setStatus("Choose a document first.");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setStatus("Please choose a document smaller than 15 MB.");
      return;
    }

    setIsUploading(true);
    setStatus(`Uploading ${selectedFile.name}…`);
    const formData = new FormData();
    formData.set("file", selectedFile);

    try {
      const response = await fetch("/api/documents", { method: "POST", body: formData });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setStatus("Document uploaded successfully.");
      await loadDocuments();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  async function deleteDocument(document: StoredDocument) {
    if (!window.confirm(`Delete ${document.name}? This cannot be undone.`)) return;
    setStatus(`Deleting ${document.name}…`);
    try {
      const response = await fetch(`/api/documents?key=${encodeURIComponent(document.key)}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Delete failed.");
      setStatus("Document deleted.");
      await loadDocuments();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed. Please try again.");
    }
  }

  return (
    <div className="document-store">
      <ul className="download-list">
        <li><a href="/resources/gospel-of-john-study-guide.md" download><span>Gospel of John Study Guide</span><small>Markdown document · 4 KB</small></a></li>
        <li><a href="/resources/class-schedule.md" download><span>Weeks 10–21 Schedule</span><small>Markdown document · 2 KB</small></a></li>
        {documents.map((document) => (
          <li key={document.key} className="uploaded-document">
            <a href={`/api/documents?key=${encodeURIComponent(document.key)}`} download={document.name}>
              <span>{document.name}</span>
              <small>Uploaded document · {formatSize(document.size)}</small>
            </a>
            {isAdmin && <button type="button" className="document-delete" onClick={() => void deleteDocument(document)} aria-label={`Delete ${document.name}`}>Delete</button>}
          </li>
        ))}
      </ul>
      {isAdmin && <form className="upload-panel" onSubmit={uploadDocument}>
        <div>
          <strong>Add a class document</strong>
          <small>PDF, Word, text, presentation, or spreadsheet · up to 15 MB</small>
        </div>
        <label className="file-picker">
          <span>{selectedFile ? "Choose another" : "Choose file"}</span>
          <input ref={inputRef} type="file" name="file" accept={ACCEPTED_EXTENSIONS} onChange={chooseFile} />
        </label>
        <button type="submit" disabled={!selectedFile || isUploading}>{isUploading ? "Uploading…" : "Upload"}</button>
        <p className="upload-status" role="status" aria-live="polite">{status}</p>
      </form>}
      {!isAdmin && <p className="visitor-note">You have visitor access. Administrators manage uploaded documents.</p>}
    </div>
  );
}
