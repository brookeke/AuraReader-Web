import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("the HTML entry keeps its layout when opened without Vite", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const main = await readFile(new URL("src/main.js", projectRoot), "utf8");

  assert.match(html, /<link rel="stylesheet" href="\.\/src\/styles\.css" \/>/);
  assert.match(html, /<script type="module" src="\.\/src\/main\.js"><\/script>/);
  assert.doesNotMatch(main, /import\s+["']\.\/styles\.css["']/);
});

test("image paths also resolve when GitHub Pages serves the repository root", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const imageSources = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(
    (match) => match[1],
  );

  assert.ok(imageSources.length > 0, "expected image sources in index.html");
  for (const source of imageSources) {
    await assert.doesNotReject(
      access(new URL(source, projectRoot)),
      `image source does not exist at repository root: ${source}`,
    );
  }
});

test("the footer does not position AuraReader as made only for Xiao Zhi Pico", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");

  assert.doesNotMatch(html, /为小纸\s*Pico\s*而作/i);
});

test("the published release replaces the development placeholder copy", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const main = await readFile(new URL("src/main.js", projectRoot), "utf8");

  assert.match(html, /AuraReader v0\.1\.0/);
  assert.doesNotMatch(html, /固件加紧开发中/);
  assert.match(main, /固件 \$\{release\.version\} 已就绪/);
});

test("the interface gallery becomes one readable column at the tablet breakpoint", async () => {
  const css = await readFile(new URL("src/styles.css", projectRoot), "utf8");
  const tabletStart = css.indexOf("@media (max-width: 879px)");
  const mobileStart = css.indexOf("@media (max-width: 620px)");
  const tabletStyles = css.slice(tabletStart, mobileStart);

  assert.match(tabletStyles, /\.screen-gallery\s*\{[^}]*grid-template-columns:\s*1fr;/s);
  assert.match(tabletStyles, /\.screen-card\s*\{[^}]*width:\s*min\(72vw,\s*22rem\);/s);
});
