"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { withBasePath } from "@/lib/base-path";
import AssetEditModal from "./asset-edit-modal";
import ResourceViewer from "./resource-viewer";

type StoredImage = {
  key: string;
  name: string;
  filename: string;
  displayText: string;
  size: number;
  uploaded: string;
};
type ApiResult = { error?: string; sessionId?: string; chunkSize?: number; totalChunks?: number };

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ".png,.jpg,.jpeg,.webp,.gif";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readApiResult(response: Response): Promise<ApiResult> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as ApiResult;
  } catch {
    const tooLarge = response.status === 413 || text.toLowerCase().includes("payload too large");
    return { error: tooLarge ? "The upload request was too large. Please try again." : text };
  }
}

export default function ImageStore({ isAdmin }: { isAdmin: boolean }) {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayText, setDisplayText] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingDisplayText, setEditingDisplayText] = useState("");
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editingImage = images.find((image) => image.key === editingKey) ?? null;
  const viewingImage = images.find((image) => image.key === viewingKey) ?? null;

  const loadImages = useCallback(async () => {
    try {
      const response = await fetch(withBasePath("/api/images"), { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load Reference Library assets.");
      const data = (await response.json()) as { images: StoredImage[] };
      setImages(data.images);
    } catch {
      setStatus("Reference Library assets are temporarily unavailable.");
    }
  }, []);

  useEffect(() => { void loadImages(); }, [loadImages]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setDisplayText(file?.name ?? "");
    setStatus(file ? `${file.name} is ready to upload.` : "");
  }

  async function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) return setStatus("Choose a reference asset first.");
    if (!displayText.trim()) return setStatus("Display text is required.");
    if (selectedFile.size > MAX_FILE_SIZE) return setStatus("Please choose an image smaller than 10 MB.");
    setIsUploading(true);
    setStatus(`Preparing ${selectedFile.name}…`);
    try {
      const startResponse = await fetch(withBasePath("/api/images?action=start"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: selectedFile.name, displayText, size: selectedFile.size, type: selectedFile.type }),
      });
      const start = await readApiResult(startResponse);
      if (!startResponse.ok || !start.sessionId || !start.chunkSize || !start.totalChunks) throw new Error(start.error || "The upload could not be started.");

      for (let index = 0; index < start.totalChunks; index += 1) {
        const beginning = index * start.chunkSize;
        const piece = selectedFile.slice(beginning, Math.min(beginning + start.chunkSize, selectedFile.size));
        const chunkResponse = await fetch(withBasePath(`/api/images?action=chunk&sessionId=${encodeURIComponent(start.sessionId)}&index=${index}`), { method: "POST", body: piece });
        const chunkResult = await readApiResult(chunkResponse);
        if (!chunkResponse.ok) throw new Error(chunkResult.error || "Part of the image could not be uploaded.");
        setStatus(`Uploading ${selectedFile.name}… ${Math.round(((index + 1) / start.totalChunks) * 100)}%`);
      }

      const completeResponse = await fetch(withBasePath(`/api/images?action=complete&sessionId=${encodeURIComponent(start.sessionId)}`), { method: "POST" });
      const completeResult = await readApiResult(completeResponse);
      if (!completeResponse.ok) throw new Error(completeResult.error || "The image could not be finalized.");
      setSelectedFile(null);
      setDisplayText("");
      if (inputRef.current) inputRef.current.value = "";
      setStatus("Reference asset uploaded successfully.");
      await loadImages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  async function updateDisplayText(image: StoredImage) {
    const nextDisplayText = editingDisplayText.trim();
    if (!nextDisplayText) return setStatus("Display text is required.");
    setStatus(`Updating ${image.filename}…`);
    try {
      const response = await fetch(withBasePath("/api/images"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: image.key, displayText: nextDisplayText }),
      });
      const result = await readApiResult(response);
      if (!response.ok) throw new Error(result.error || "Update failed.");
      setEditingKey(null);
      setEditingDisplayText("");
      setStatus("Reference Library display text updated.");
      await loadImages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Update failed. Please try again.");
    }
  }

  async function deleteImage(image: StoredImage) {
    if (!window.confirm(`Delete ${image.filename}? This cannot be undone.`)) return;
    setStatus(`Deleting ${image.filename}…`);
    try {
      const response = await fetch(withBasePath(`/api/images?key=${encodeURIComponent(image.key)}`), { method: "DELETE" });
      const result = await readApiResult(response);
      if (!response.ok) throw new Error(result.error || "Delete failed.");
      setStatus("Reference asset deleted.");
      await loadImages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed. Please try again.");
    }
  }

  return (
    <div className="image-store">
      <ul className="download-list">
        <li><a href={withBasePath("/resources/gospel-of-john-class-cover.png")} download><span>Gospel of John Class Cover</span><small>PNG image · landscape</small></a></li>
        {images.map((image) => (
          <li key={image.key} className="uploaded-document">
            <button type="button" className="resource-view-trigger" onClick={() => setViewingKey(image.key)} aria-label={`View ${image.displayText}`}><span>{image.displayText}</span><small>{isAdmin ? `Filename: ${image.filename} · ` : ""}Reference asset · {formatSize(image.size)}</small></button>
            <div className="asset-row-actions">
              <a className="resource-download-action" href={withBasePath(`/api/images?key=${encodeURIComponent(image.key)}`)} download={image.filename}>Download Original</a>
              {isAdmin && <>
              <button type="button" className="edit-button" onClick={() => { setEditingKey(image.key); setEditingDisplayText(image.displayText); }}>Edit text</button>
              <button type="button" className="document-delete" onClick={() => void deleteImage(image)} aria-label={`Delete ${image.filename}`}>Delete</button>
              </>}
            </div>
          </li>
        ))}
      </ul>
      {isAdmin && editingImage && <AssetEditModal
        title="Reference Library Asset"
        filename={editingImage.filename}
        value={editingDisplayText}
        onChange={setEditingDisplayText}
        onCancel={() => setEditingKey(null)}
        onSubmit={(event) => { event.preventDefault(); void updateDisplayText(editingImage); }}
      />}
      {viewingImage && <ResourceViewer
        resource={{
          title: viewingImage.displayText || viewingImage.filename,
          filename: viewingImage.filename,
          url: withBasePath(`/api/images?key=${encodeURIComponent(viewingImage.key)}`),
        }}
        onClose={() => setViewingKey(null)}
      />}
      {isAdmin && <form className="upload-panel" onSubmit={uploadImage}>
        <div><strong>Add a reference asset</strong><small>PNG, JPG, WebP, or GIF · up to 10 MB</small></div>
        <label className="asset-display-field"><span>Display text</span><input type="text" value={displayText} onChange={(event) => setDisplayText(event.target.value)} maxLength={160} placeholder="Text shown in the Reference Library list" required /></label>
        <label className="file-picker"><span>{selectedFile ? "Choose another" : "Choose image"}</span><input ref={inputRef} type="file" name="file" accept={ACCEPTED_TYPES} onChange={chooseFile} /></label>
        <button type="submit" disabled={!selectedFile || !displayText.trim() || isUploading}>{isUploading ? "Uploading…" : "Upload"}</button>
        <p className="upload-status" role="status" aria-live="polite">{status}</p>
      </form>}
      {!isAdmin && <p className="visitor-note">Reference Library assets are available to everyone. Administrators manage uploads.</p>}
    </div>
  );
}
