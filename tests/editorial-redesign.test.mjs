import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("the editorial homepage follows the planned information architecture", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const sectionIds = ["top", "introduction", "flasher", "guide", "changelog", "faq"];
  let previousIndex = -1;

  for (const id of sectionIds) {
    const index = html.indexOf(`id="${id}"`);
    assert.ok(index > previousIndex, `expected #${id} after the previous planned section`);
    previousIndex = index;
  }

  assert.match(html, />AURA READER <span[^>]*>\/ 余白<\/span><\/a>/);
  assert.match(html, /Wi-Fi 传书/);
  assert.match(html, /固件更新日志/);
  assert.match(html, /data-version-options/);
});

test("key editorial headings stay intact across browser font metrics", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const css = await readFile(new URL("src/styles.css", projectRoot), "utf8");

  assert.match(html, /id="faq-title">常见问题，<br\s*\/><span>逐一解答。<\/span><\/h2>/);
  assert.match(css, /#hero-title,[^}]*#guide-title,[^}]*#changelog-title[^}]*\{[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /#hero-title,[^}]*#guide-title,[^}]*#changelog-title[^}]*font-size:\s*clamp\(2\.4rem,\s*5\.5vw,\s*5\.6rem\)/s);
});

test("the visual system stays flat, square and monochrome", async () => {
  const css = await readFile(new URL("src/styles.css", projectRoot), "utf8");

  assert.match(css, /--paper:\s*#f9f8f6/i);
  assert.match(css, /--ink:\s*#1c1c1c/i);
  assert.match(css, /\.site-header\s*\{[^}]*position:\s*fixed;/s);
  assert.doesNotMatch(css, /border-radius|box-shadow|linear-gradient|radial-gradient/i);
});

test("the release catalog supports at most two installable versions", async () => {
  const service = await readFile(new URL("src/release-service.js", projectRoot), "utf8");
  const flasher = await readFile(new URL("src/web-flasher.js", projectRoot), "utf8");

  assert.match(service, /slice\(0,\s*2\)/);
  assert.match(flasher, /data-version-options/);
  assert.match(flasher, /setReleases/);
  assert.doesNotMatch(flasher, /const FIRMWARE_URL/);
});

test("release catalog normalization keeps only valid installable entries", async () => {
  const { parseReleaseCatalog } = await import(new URL("src/release-service.js", projectRoot));
  const releases = parseReleaseCatalog({
    releases: [
      { version: "0.3.0", channel: "stable", path: "./firmware/v0.3.0/full.bin" },
      { version: "0.2.0", channel: "beta", path: "./firmware/v0.2.0/full.bin" },
      { version: "0.1.0", channel: "stable", path: "./firmware/v0.1.0/full.bin" },
    ],
  });

  assert.equal(releases.length, 2);
  assert.deepEqual(releases.map(({ version }) => version), ["0.3.0", "0.2.0"]);
  assert.equal(releases[0].path, "./firmware/v0.3.0/full.bin");
});
