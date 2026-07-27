import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mergeAssetMetadata, normalizeDisplayText } from "../lib/asset-metadata";

test("existing assets fall back to their preserved filename", () => {
  assert.equal(normalizeDisplayText(undefined, "existing-file.pdf"), "existing-file.pdf");
  assert.equal(normalizeDisplayText("  Weekly   Handout  ", "existing-file.pdf"), "Weekly Handout");
});

test("display-text updates preserve all existing asset metadata", () => {
  assert.deepEqual(
    mergeAssetMetadata(
      {
        originalName: "existing-file.pdf",
        uploadedBy: "owner@example.com",
        customField: "preserved",
      },
      "Week 12 Handout",
      "fallback.pdf",
    ),
    {
      originalName: "existing-file.pdf",
      uploadedBy: "owner@example.com",
      customField: "preserved",
      displayText: "Week 12 Handout",
    },
  );
});

test("resource areas use the requested names and default to open", async () => {
  const [home, admin] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(home, /<strong>Class Materials<\/strong>/);
  assert.match(home, /<strong>Reference Library<\/strong>/);
  assert.match(home, /<details className="resource-card" open>[\s\S]*Class Materials/);
  assert.match(home, /Class Materials[\s\S]*<details className="resource-card" open>[\s\S]*Reference Library/);
  assert.match(admin, /<strong>Class Materials<\/strong>/);
  assert.match(admin, /<strong>Reference Library<\/strong>/);
});

test("both asset APIs expose display text and authenticated metadata updates", async () => {
  const [documentsRoute, imagesRoute, storage] = await Promise.all([
    readFile(new URL("../app/api/documents/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/images/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/blob-storage.ts", import.meta.url), "utf8"),
  ]);
  for (const source of [documentsRoute, imagesRoute]) {
    assert.match(source, /displayText/);
    assert.match(source, /export async function PATCH/);
    assert.match(source, /requireAdminApi/);
    assert.match(source, /updateCustomMetadata/);
  }
  assert.match(storage, /const merged = \{ \.\.\.existing, \.\.\.metadata \}/);
  assert.match(storage, /allowOverwrite:\s*true/);
});

test("Edit Text uses a roomy modal for both asset libraries", async () => {
  const [documents, images, modal, styles] = await Promise.all([
    readFile(new URL("../app/document-store.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/image-store.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/asset-edit-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(documents, /<AssetEditModal/);
  assert.match(images, /<AssetEditModal/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /<textarea/);
  assert.match(modal, /rows=\{4\}/);
  assert.match(styles, /\.asset-modal\s*\{[^}]*760px/);
  assert.match(styles, /\.asset-modal textarea\s*\{[^}]*min-height:\s*130px/);
});

test("uploaded resources use lazy public viewers without admin controls", async () => {
  const [viewer, pdf, docx, documents, images, documentsRoute, packageJson] = await Promise.all([
    readFile(new URL("../app/resource-viewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pdf-resource-preview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/docx-resource-preview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/document-store.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/image-store.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/documents/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(viewer, /lazy\(\(\) => import\(["']\.\/pdf-resource-preview["']\)\)/);
  assert.match(viewer, /lazy\(\(\) => import\(["']\.\/docx-resource-preview["']\)\)/);
  assert.match(viewer, /Download Original/);
  assert.match(viewer, /requestFullscreen/);
  assert.match(viewer, /Preview unavailable/);
  assert.doesNotMatch(viewer, /Edit text|Delete/);
  assert.match(pdf, /import\(["']pdfjs-dist["']\)/);
  assert.match(pdf, /response\.arrayBuffer\(\)/);
  assert.match(docx, /import\(["']docx-preview["']\)/);
  assert.match(docx, /renderAsync/);
  assert.match(documents, /<ResourceViewer/);
  assert.match(images, /<ResourceViewer/);
  assert.match(documents, /import \{ upload \} from "@vercel\/blob\/client"/);
  assert.match(documents, /multipart:\s*true/);
  assert.match(documents, /onUploadProgress/);
  assert.match(documents, /Any file type/);
  assert.doesNotMatch(documents, /accept=\{/);
  assert.doesNotMatch(documents, /MAX_FILE_SIZE|ACCEPTED_EXTENSIONS|Legacy \.doc/);
  assert.match(documentsRoute, /handleUpload/);
  assert.match(documentsRoute, /maximumSizeInBytes:\s*MAX_FILE_SIZE/);
  assert.doesNotMatch(documentsRoute, /ALLOWED_EXTENSIONS|Legacy \.doc/);
  assert.match(packageJson, /"pdfjs-dist"/);
  assert.match(packageJson, /"docx-preview"/);
});
