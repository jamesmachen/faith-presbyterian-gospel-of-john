"use client";

import { FormEvent, useEffect } from "react";

type AssetEditModalProps = {
  title: string;
  filename: string;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function AssetEditModal({
  title,
  filename,
  value,
  onChange,
  onCancel,
  onSubmit,
}: AssetEditModalProps) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  return (
    <div className="asset-modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="asset-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={onSubmit}>
          <div className="asset-modal-heading">
            <div>
              <p className="eyebrow">Edit display text</p>
              <h2 id="asset-modal-title">{title}</h2>
            </div>
            <button type="button" className="asset-modal-close" onClick={onCancel} aria-label="Close edit form">×</button>
          </div>
          <p className="asset-modal-filename"><strong>Filename:</strong> {filename}</p>
          <label>
            <span>Display text</span>
            <textarea
              autoFocus
              rows={4}
              wrap="soft"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              maxLength={160}
              required
            />
            <small>{value.length}/160 characters</small>
          </label>
          <div className="asset-modal-actions">
            <button type="button" className="button button-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="button button-primary">Save display text</button>
          </div>
        </form>
      </section>
    </div>
  );
}

