import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("GitHub Actions verifies and builds the branch-hosted site", async () => {
  const workflow = await readFile(
    new URL(".github/workflows/verify.yml", projectRoot),
    "utf8",
  );

  assert.match(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /run:\s*pnpm install --frozen-lockfile/);
  assert.match(workflow, /run:\s*pnpm verify/);
  assert.doesNotMatch(workflow, /actions\/configure-pages/);
  assert.doesNotMatch(workflow, /actions\/deploy-pages/);
});

test("static hosting keeps Vite asset paths relative and disables Jekyll", async () => {
  const viteConfig = await readFile(new URL("vite.config.ts", projectRoot), "utf8");
  const noJekyll = await readFile(new URL("public/.nojekyll", projectRoot), "utf8");

  assert.match(viteConfig, /base:\s*["']\.\/["']/);
  assert.equal(noJekyll.trim(), "");
});
