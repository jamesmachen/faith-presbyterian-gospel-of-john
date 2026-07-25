"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";

type StoredImage = { key: string; name: string; size: number; uploaded: string };
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
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(async () => {
    try {
      const response = await fetch("/api/images", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load uploaded images.");
      const data = (await response.json()) as { images: StoredImage[] };
      setImages(data.images);
    } catch {
      setStatus("Uploaded images are temporarily unavailable.");
    }
  }, []);

  useEffect(() => { void loadImages(); }, [loadImages]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setStatus(file ? `${file.name} is ready to upload.` : "");
  }

  async function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) return setStatus("Choose an image first.");
    if (selectedFile.size > MAX_FILE_SIZE) return setStatus("Please choose an image smaller than 10 MB.");
    setIsUploading(true);
    setStatus(`Preparing ${selectedFile.name}…`);
    try {
      const startResponse = await fetch("/api/images?action=start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: selectedFile.name, size: selectedFile.size, type: selectedFile.type }),
      });
      const start = await readApiResult(startResponse);
      if (!startResponse.ok || !start.sessionId || !start.chunkSize || !start.totalChunks) throw new Error(start.error || "The upload could not be started.");

      for (let index = 0; index < start.totalChunks; index += 1) {
        const beginning = index * start.chunkSize;
        const piece = selectedFile.slice(beginning, Math.min(beginning + start.chunkSize, selectedFile.size));
        const chunkResponse = await fetch(`/api/images?action=chunk&sessionId=${encodeURIComponent(start.sessionId)}&index=${index}`, { method: "POST", body: piece });
        const chunkResult = await readApiResult(chunkResponse);
        if (!chunkResponse.ok) throw new Error(chunkResult.error || "Part of the image could not be uploaded.");
        setStatus(`Uploading ${selectedFile.name}… ${Math.round(((index + 1) / start.totalChunks) * 100)}%`);
      }

      const completeResponse = await fetch(`/api/images?action=complete&sessionId=${encodeURIComponent(start.sessionId)}`, { method: "POST" });
      const completeResult = await readApiResult(completeResponse);
      if (!completeResponse.ok) throw new Error(completeResult.error || "The image could not be finalized.");
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setStatus("Image uploaded successfully.");
      await loadImages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  async function deleteImage(image: StoredImage) {
    if (!window.confirm(`Delete ${image.name}? This cannot be undone.`)) return;
    setStatus(`Deleting ${image.name}…`);
    try {
      const response = await fetch(`/api/images?key=${encodeURIComponent(image.key)}`, { method: "DELETE" });
      const result = await readApiResult(response);
      if (!response.ok) throw new Error(result.error || "Delete failed.");
      setStatus("Image deleted.");
      await loadImages();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed. Please try again.");
    }
  }

  return (
    <div className="image-store">
      <ul className="download-list">
        <li><a href="/resources/gospel-of-john-class-cover.png" download><span>Gospel of John Class Cover</span><small>PNG image · landscape</small></a></li>
        {images.map((image) => (
          <li key={image.key} className="uploaded-document">
            <a href={`/api/images?key=${encodeURIComponent(image.key)}`} download={image.name}><span>{image.name}</span><small>Uploaded image · {formatSize(image.size)}</small></a>
            {isAdmin && <button type="button" className="document-delete" onClick={() => void deleteImage(image)} aria-label={`Delete ${image.name}`}>Delete</button>}
          </li>
        ))}
      </ul>
      {isAdmin && <form className="upload-panel" onSubmit={uploadImage}>
        <div><strong>Add a class image</strong><small>PNG, JPG, WebP, or GIF · up to 10 MB</small></div>
        <label className="file-picker"><span>{selectedFile ? "Choose another" : "Choose image"}</span><input ref={inputRef} type="file" name="file" accept={ACCEPTED_TYPES} onChange={chooseFile} /></label>
        <button type="submit" disabled={!selectedFile || isUploading}>{isUploading ? "Uploading…" : "Upload"}</button>
        <p className="upload-status" role="status" aria-live="polite">{status}</p>
      </form>}
      {!isAdmin && <p className="visitor-note">Images are available to everyone. Administrators manage uploads.</p>}
    </div>
  );
}
