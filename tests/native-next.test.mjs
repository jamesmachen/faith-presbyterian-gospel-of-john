import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("uses native Next.js scripts without Cloudflare build tooling", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("package.json", root), "utf8"),
  );

  assert.equal(packageJson.scripts.dev, "next dev");
  assert.equal(packageJson.scripts.build, "next build");
  assert.equal(packageJson.scripts.start, "next start");

  for (const dependency of [
    "vinext",
    "vite",
    "wrangler",
    "@cloudflare/vite-plugin",
    "@vitejs/plugin-react",
    "@vitejs/plugin-rsc",
  ]) {
    assert.equal(packageJson.dependencies?.[dependency], undefined);
    assert.equal(packageJson.devDependencies?.[dependency], undefined);
  }
});

test("creates native Next.js output", async () => {
  await access(new URL(".next/BUILD_ID", root));
});
