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

test("configures the canonical base path and unprefixed legacy redirect", async () => {
  const [nextConfig, basePathHelper] = await Promise.all([
    readFile(new URL("next.config.ts", root), "utf8"),
    readFile(new URL("lib/base-path.ts", root), "utf8"),
  ]);

  assert.match(nextConfig, /basePath:\s*["']\/sunday-school["']/);
  assert.match(nextConfig, /source:\s*["']\/["'][\s\S]*destination:\s*["']\/john["']/);
  assert.match(nextConfig, /source:\s*["']\/sundayschool["']/);
  assert.match(nextConfig, /destination:\s*["']\/sunday-school\/john["']/);
  assert.match(nextConfig, /permanent:\s*true/);
  assert.match(nextConfig, /basePath:\s*false/);
  assert.match(basePathHelper, /BASE_PATH\s*=\s*["']\/sunday-school["']/);
  assert.match(basePathHelper, /HOME_PATH\s*=\s*["']\/john["']/);
});
