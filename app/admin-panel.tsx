"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { StudyPassageConfig } from "./site-config";
import { withBasePath } from "@/lib/base-path";

type ManagedUser = {
  email: string;
  role: "owner" | "admin";
  displayName: string | null;
  active: boolean;
  status: "invited" | "active" | "disabled";
  createdAt: string;
  createdBy: string;
  lastSignInAt: string | null;
};
type ManagedTranslation = { id: string; name: string; abbreviation: string; url: string; iconKey: string | null };
type TranslationApiResult = { error?: string; sessionId?: string; chunkSize?: number; totalChunks?: number; iconKey?: string };

async function readTranslationResult(response: Response): Promise<TranslationApiResult> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as TranslationApiResult;
  } catch {
    const tooLarge = response.status === 413 || text.toLowerCase().includes("payload too large");
    return { error: tooLarge ? "The icon upload request was too large. Please try again." : text };
  }
}

async function uploadTranslationIcon(icon: File, onProgress: (message: string) => void) {
  onProgress(`Preparing ${icon.name}…`);
  const startResponse = await fetch(withBasePath("/api/translations?action=icon-start"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ size: icon.size, type: icon.type }),
  });
  const start = await readTranslationResult(startResponse);
  if (!startResponse.ok || !start.sessionId || !start.chunkSize || !start.totalChunks) throw new Error(start.error || "The icon upload could not be started.");

  for (let index = 0; index < start.totalChunks; index += 1) {
    const beginning = index * start.chunkSize;
    const piece = icon.slice(beginning, Math.min(beginning + start.chunkSize, icon.size));
    const chunkResponse = await fetch(withBasePath(`/api/translations?action=icon-chunk&sessionId=${encodeURIComponent(start.sessionId)}&index=${index}`), { method: "POST", body: piece });
    const chunkResult = await readTranslationResult(chunkResponse);
    if (!chunkResponse.ok) throw new Error(chunkResult.error || "Part of the icon could not be uploaded.");
    onProgress(`Uploading ${icon.name}… ${Math.round(((index + 1) / start.totalChunks) * 100)}%`);
  }

  const completeResponse = await fetch(withBasePath(`/api/translations?action=icon-complete&sessionId=${encodeURIComponent(start.sessionId)}`), { method: "POST" });
  const complete = await readTranslationResult(completeResponse);
  if (!completeResponse.ok || !complete.iconKey) throw new Error(complete.error || "The icon could not be finalized.");
  return complete.iconKey;
}

export default function AdminPanel({ currentEmail, currentRole }: { currentEmail: string; currentRole: "owner" | "admin" }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [translations, setTranslations] = useState<ManagedTranslation[]>([]);
  const [passages, setPassages] = useState<StudyPassageConfig[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState("");
  const [translationStatus, setTranslationStatus] = useState("");
  const [scheduleStatus, setScheduleStatus] = useState("");
  const [editingTranslationId, setEditingTranslationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    const response = await fetch(withBasePath("/api/users"), { cache: "no-store" });
    const result = (await response.json()) as { users?: ManagedUser[]; error?: string };
    if (!response.ok) throw new Error(result.error || "Could not load users.");
    setUsers(result.users ?? []);
  }, []);

  const loadTranslations = useCallback(async () => {
    const response = await fetch(withBasePath("/api/translations"), { cache: "no-store" });
    const result = (await response.json()) as { translations?: ManagedTranslation[]; error?: string };
    if (!response.ok) throw new Error(result.error || "Could not load Bible resources.");
    setTranslations(result.translations ?? []);
  }, []);

  const loadPassages = useCallback(async () => {
    const response = await fetch(withBasePath("/api/site-config"), { cache: "no-store" });
    const result = (await response.json()) as { passages?: StudyPassageConfig[]; error?: string };
    if (!response.ok) throw new Error(result.error || "Could not load the study schedule.");
    setPassages(result.passages ?? []);
  }, []);

  useEffect(() => {
    loadUsers().catch((error) => setStatus(error instanceof Error ? error.message : "Could not load users."));
    loadTranslations().catch((error) => setTranslationStatus(error instanceof Error ? error.message : "Could not load Bible resources."));
    loadPassages().catch((error) => setScheduleStatus(error instanceof Error ? error.message : "Could not load the study schedule."));
  }, [loadPassages, loadTranslations, loadUsers]);

  function updatePassage(id: string, field: "weekLabel" | "scriptureLabel" | "descriptionLabel", value: string) {
    setPassages((current) => current.map((passage) => passage.id === id ? { ...passage, [field]: value } : passage));
  }

  async function savePassages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setScheduleStatus("Saving passage tiles…");
    try {
      const response = await fetch(withBasePath("/api/site-config"), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passages }),
      });
      const result = (await response.json()) as { passages?: StudyPassageConfig[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save the study schedule.");
      setPassages(result.passages ?? passages);
      setScheduleStatus("Passage tiles updated.");
    } catch (error) {
      setScheduleStatus(error instanceof Error ? error.message : "Could not save the study schedule.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTranslation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setTranslationStatus("");
    const form = event.currentTarget;
    try {
      const formData = new FormData(form);
      const icon = formData.get("icon");
      const iconKey = icon instanceof File && icon.size ? await uploadTranslationIcon(icon, setTranslationStatus) : null;
      setTranslationStatus("Saving Bible resource…");
      const response = await fetch(withBasePath("/api/translations?action=create"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: formData.get("name"), abbreviation: formData.get("abbreviation"), url: formData.get("url"), iconKey }),
      });
      const result = await readTranslationResult(response);
      if (!response.ok) throw new Error(result.error || "Could not add this Bible resource.");
      form.reset();
      setTranslationStatus("Bible resource added.");
      await loadTranslations();
      window.dispatchEvent(new Event("translations-updated"));
    } catch (error) {
      setTranslationStatus(error instanceof Error ? error.message : "Could not add this Bible resource.");
    } finally {
      setBusy(false);
    }
  }

  async function updateTranslation(event: FormEvent<HTMLFormElement>, translation: ManagedTranslation) {
    event.preventDefault();
    setBusy(true);
    setTranslationStatus("");
    try {
      const formData = new FormData(event.currentTarget);
      const icon = formData.get("icon");
      const iconKey = icon instanceof File && icon.size ? await uploadTranslationIcon(icon, setTranslationStatus) : null;
      setTranslationStatus("Saving Bible resource changes…");
      const response = await fetch(withBasePath("/api/translations"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: translation.id,
          name: formData.get("name"),
          abbreviation: formData.get("abbreviation"),
          url: formData.get("url"),
          iconKey,
          removeIcon: formData.get("removeIcon") === "on" && !iconKey,
        }),
      });
      const result = await readTranslationResult(response);
      if (!response.ok) throw new Error(result.error || "Could not update this Bible resource.");
      setEditingTranslationId(null);
      setTranslationStatus("Bible resource updated.");
      await loadTranslations();
      window.dispatchEvent(new Event("translations-updated"));
    } catch (error) {
      setTranslationStatus(error instanceof Error ? error.message : "Could not update this Bible resource.");
    } finally {
      setBusy(false);
    }
  }

  async function removeTranslation(translation: ManagedTranslation) {
    if (!window.confirm(`Remove ${translation.name}?`)) return;
    setBusy(true);
    setTranslationStatus("");
    try {
      const response = await fetch(withBasePath(`/api/translations?id=${encodeURIComponent(translation.id)}`), { method: "DELETE" });
      const result = await readTranslationResult(response);
      if (!response.ok) throw new Error(result.error || "Could not remove this Bible resource.");
      if (editingTranslationId === translation.id) setEditingTranslationId(null);
      setTranslationStatus("Bible resource removed.");
      await loadTranslations();
      window.dispatchEvent(new Event("translations-updated"));
    } catch (error) {
      setTranslationStatus(error instanceof Error ? error.message : "Could not remove this Bible resource.");
    } finally {
      setBusy(false);
    }
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(withBasePath("/api/users"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, displayName }) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save this user.");
      setEmail("");
      setDisplayName("");
      setStatus("Administrator added and sign-in invitation sent.");
      await loadUsers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save this user.");
    } finally {
      setBusy(false);
    }
  }

  async function resendInvitation(userEmail: string) {
    setBusy(true);
    try {
      const response = await fetch(withBasePath("/api/users"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: userEmail, action: "invite" }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not send the invitation.");
      setStatus(`A sign-in link was sent to ${userEmail}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send the invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function setUserActive(userEmail: string, active: boolean) {
    if (!window.confirm(`${active ? "Enable" : "Disable"} ${userEmail}?`)) return;
    setBusy(true);
    try {
      const response = await fetch(withBasePath("/api/users"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: userEmail, active }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not update this administrator.");
      setStatus(active ? "Administrator enabled." : "Administrator disabled.");
      await loadUsers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update this administrator.");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(userEmail: string) {
    if (!window.confirm(`Remove access for ${userEmail}?`)) return;
    setBusy(true);
    try {
      const response = await fetch(withBasePath(`/api/users?email=${encodeURIComponent(userEmail)}`), { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not remove this user.");
      setStatus("User removed.");
      await loadUsers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not remove this user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-section" id="admin">
      <div className="section-shell">
        <div className="section-heading solo">
          <p className="eyebrow">Administrator tools</p>
          <h2>Manage the site</h2>
          <p className="admin-intro">Update the study schedule, Bible resources, class materials, reference assets, and administrators from this dedicated page.</p>
        </div>
        <section className="admin-tool-card" id="passages" aria-labelledby="passages-admin-heading">
          <div className="admin-tool-heading">
            <div><p className="eyebrow">Site configuration</p><h3 id="passages-admin-heading">Passages for study</h3></div>
            <p>Edit the week, scripture, and description labels shown on each passage tile.</p>
          </div>
          <form className="schedule-config-form" onSubmit={savePassages}>
            <div className="schedule-config-head" aria-hidden="true"><span>Week label</span><span>Scripture label</span><span>Description label</span></div>
            {passages.map((passage) => (
              <fieldset className="schedule-config-row" key={passage.id}>
                <legend>{passage.weekLabel}</legend>
                <label><span>Week label</span><input value={passage.weekLabel} onChange={(event) => updatePassage(passage.id, "weekLabel", event.target.value)} maxLength={40} required /></label>
                <label><span>Scripture label</span><input value={passage.scriptureLabel} onChange={(event) => updatePassage(passage.id, "scriptureLabel", event.target.value)} maxLength={100} required /></label>
                <label><span>Description label</span><input value={passage.descriptionLabel} onChange={(event) => updatePassage(passage.id, "descriptionLabel", event.target.value)} maxLength={160} required /></label>
              </fieldset>
            ))}
            <div className="schedule-config-actions">
              <p className="admin-status" role="status" aria-live="polite">{scheduleStatus}</p>
              <button className="button button-primary" type="submit" disabled={busy || passages.length === 0}>Save passage tiles</button>
            </div>
          </form>
        </section>
        <section className="admin-tool-card" aria-labelledby="translations-admin-heading">
          <div className="admin-tool-heading">
            <div><p className="eyebrow">Reading links</p><h3 id="translations-admin-heading">Bible Resources</h3></div>
            <p>Add a link and an optional icon. Without an icon, the abbreviation becomes the resource badge.</p>
          </div>
          <form className="translation-form" onSubmit={saveTranslation}>
            <label><span>Translation name</span><input name="name" type="text" placeholder="New International Version" maxLength={80} required /></label>
            <label><span>Abbreviation</span><input name="abbreviation" type="text" placeholder="NIV" minLength={2} maxLength={10} required /></label>
            <label className="translation-url-field"><span>Bible link</span><input name="url" type="url" placeholder="https://www.biblegateway.com/…" required /></label>
            <label className="translation-icon-picker"><span>Icon <small>optional · up to 10 MB</small></span><input name="icon" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
            <button className="button button-primary" type="submit" disabled={busy}>Add resource</button>
          </form>
          <p className="admin-status" role="status" aria-live="polite">{translationStatus}</p>
          <div className="translation-admin-list">
            {translations.map((translation) => (
              <div className="translation-admin-item" key={translation.id}>
                <div className="translation-admin-row">
                  <span className={`translation-admin-mark${translation.iconKey ? " has-image" : ""}`}>
                    {translation.iconKey ? <img src={withBasePath(`/api/translations?iconKey=${encodeURIComponent(translation.iconKey)}`)} alt="" /> : translation.abbreviation}
                  </span>
                  <span><strong>{translation.abbreviation} · {translation.name}</strong><a href={translation.url} target="_blank" rel="noopener noreferrer">View link ↗</a></span>
                  <span className="translation-admin-actions">
                    <button type="button" className="edit-button" disabled={busy} onClick={() => setEditingTranslationId(editingTranslationId === translation.id ? null : translation.id)}>{editingTranslationId === translation.id ? "Close" : "Edit"}</button>
                    <button type="button" className="remove-button" disabled={busy} onClick={() => void removeTranslation(translation)}>Remove</button>
                  </span>
                </div>
                {editingTranslationId === translation.id && (
                  <form className="translation-edit-form" onSubmit={(event) => void updateTranslation(event, translation)}>
                    <div className="edit-form-heading"><strong>Edit {translation.abbreviation}</strong><span>Change any field, replace the icon, or remove it.</span></div>
                    <label><span>Translation name</span><input name="name" type="text" defaultValue={translation.name} maxLength={80} required /></label>
                    <label><span>Abbreviation</span><input name="abbreviation" type="text" defaultValue={translation.abbreviation} minLength={2} maxLength={10} required /></label>
                    <label className="translation-url-field"><span>Bible link</span><input name="url" type="url" defaultValue={translation.url} required /></label>
                    <label className="translation-icon-picker"><span>Replacement icon <small>optional · up to 10 MB</small></span><input name="icon" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
                    {translation.iconKey && <label className="remove-icon-option"><input name="removeIcon" type="checkbox" /><span>Remove current icon and use the abbreviation</span></label>}
                    <span className="edit-form-actions"><button className="button button-primary" type="submit" disabled={busy}>Save changes</button><button className="button button-secondary" type="button" disabled={busy} onClick={() => setEditingTranslationId(null)}>Cancel</button></span>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="admin-tool-card" aria-labelledby="administrators-heading">
          <div className="admin-tool-heading compact"><div><p className="eyebrow">Access</p><h3 id="administrators-heading">Administrators</h3></div></div>
          <form className="add-user-form admin-only" onSubmit={saveUser}>
            <label><span>Administrator email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="person@example.com" required /></label>
            <label><span>Display name <small>optional</small></span><input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} /></label>
            <button className="button button-primary" type="submit" disabled={busy}>Add & invite administrator</button>
          </form>
          <p className="admin-status" role="status" aria-live="polite">{status}</p>
          <div className="user-table" role="region" aria-label="Site administrators" tabIndex={0}>
            <table>
              <thead><tr><th>Administrator</th><th>Role</th><th>Status</th><th>Added</th><th>Last sign in</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {users.map((managedUser) => {
                  const isCurrentUser = managedUser.email.toLowerCase() === currentEmail.toLowerCase();
                  const isOwner = managedUser.role === "owner";
                  const canManage = currentRole === "owner" && !isOwner && !isCurrentUser;
                  return <tr key={managedUser.email}>
                    <td><strong>{managedUser.displayName || managedUser.email}</strong>{managedUser.displayName && <small>{managedUser.email}</small>}{isCurrentUser && <small>You</small>}</td>
                    <td>{isOwner ? "Owner" : "Administrator"}</td>
                    <td>{managedUser.status === "invited" ? "Invited / not yet signed in" : managedUser.status === "active" ? "Active" : "Disabled"}</td>
                    <td>{new Date(managedUser.createdAt).toLocaleDateString()}</td>
                    <td>{managedUser.lastSignInAt ? new Date(managedUser.lastSignInAt).toLocaleDateString() : "Never"}</td>
                    <td>
                      <button type="button" className="edit-button" disabled={busy || !managedUser.active} onClick={() => void resendInvitation(managedUser.email)}>Resend link</button>
                      {!isOwner && <button type="button" className="edit-button" disabled={busy || !canManage} onClick={() => void setUserActive(managedUser.email, !managedUser.active)}>{managedUser.active ? "Disable" : "Enable"}</button>}
                      {!isOwner && <button type="button" className="remove-button" disabled={busy || !canManage} onClick={() => void removeUser(managedUser.email)}>Remove</button>}
                      {isOwner && <small>Protected owner</small>}
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
