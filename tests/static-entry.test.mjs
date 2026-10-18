import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("the HTML entry keeps its layout when opened without Vite", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const main = await readFile(new URL("src/main.js", projectRoot), "utf8");

  assert.match(html, /<link rel="stylesheet" href="\.\/src\/styles\.css" \/>/);
  assert.match(html, /<script type="module" src="\.\/src\/main\.js\?v=2\.5\.0"><\/script>/);
  assert.doesNotMatch(main, /import\s+["']\.\/styles\.css["']/);
});

test("branch-hosted source modules are cache-busted together", async () => {
  const main = await readFile(new URL("src/main.js", projectRoot), "utf8");

  assert.match(main, /"\.\/release-service\.js\?v=2\.5\.0"/);
  assert.match(main, /"\.\/header-visibility\.js\?v=2\.5\.0"/);
  assert.match(main, /"\.\/web-flasher\.js\?v=2\.5\.0"/);
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

test("the verified AuraReader and official demo releases are presented as ready", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const main = await readFile(new URL("src/main.js", projectRoot), "utf8");

  assert.match(html, /v0\.5\.0/);
  assert.doesNotMatch(html, /固件加紧开发中/);
  assert.match(html, /AuraReader 与小纸 Pico 官方演示固件均提供完整镜像/);
  assert.doesNotMatch(html, /当前暂停网页烧录/);
  assert.match(main, /固件 \$\{release\.label\} 已就绪/);
  assert.match(main, /固件 v\$\{availability\.version\} 烧录已暂停/);
});

test("the current public changelog records only alpha.26 optimization work", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");

  assert.match(html, /<h3>v0\.5\.0-firefly\.alpha\.26<\/h3>/);
  assert.match(html, /优化翻页性能分析/);
  assert.match(html, /优化 EPUB 后台缓存耗时定位/);
  assert.match(html, /优化字体性能计时口径/);
  assert.doesNotMatch(html, /临时性能诊断|缓存诊断|诊断固件/);
});

test("the interface gallery becomes one readable column at the tablet breakpoint", async () => {
  const css = await readFile(new URL("src/styles.css", projectRoot), "utf8");
  const tabletStart = css.indexOf("@media (max-width: 879px)");
  const mobileStart = css.indexOf("@media (max-width: 620px)");
  const tabletStyles = css.slice(tabletStart, mobileStart);

  assert.match(tabletStyles, /\.screen-gallery\s*\{[^}]*grid-template-columns:\s*1fr;/s);
  assert.match(tabletStyles, /\.screen-card\s*\{[^}]*width:\s*min\(72vw,\s*22rem\);/s);
});
