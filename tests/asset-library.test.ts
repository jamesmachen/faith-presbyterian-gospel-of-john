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
});

