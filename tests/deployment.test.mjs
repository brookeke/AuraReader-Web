import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("GitHub Pages workflow verifies, builds, and deploys the site", async () => {
  const workflow = await readFile(
    new URL(".github/workflows/deploy-pages.yml", projectRoot),
    "utf8",
  );

  assert.match(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /run:\s*pnpm install --frozen-lockfile/);
  assert.match(workflow, /run:\s*pnpm verify/);
  assert.match(workflow, /uses:\s*actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /path:\s*dist/);
  assert.match(workflow, /uses:\s*actions\/deploy-pages@v4/);
});

test("static hosting keeps Vite asset paths relative and disables Jekyll", async () => {
  const viteConfig = await readFile(new URL("vite.config.ts", projectRoot), "utf8");
  const noJekyll = await readFile(new URL("public/.nojekyll", projectRoot), "utf8");

  assert.match(viteConfig, /base:\s*["']\.\/["']/);
  assert.equal(noJekyll.trim(), "");
});

