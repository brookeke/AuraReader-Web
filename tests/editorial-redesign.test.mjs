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

test("the changelog shows alpha.77 followed by alpha.71", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const changelog = html.match(/<div class="release-list" data-visible-limit="2">([\s\S]*?)<\/div>\s*<\/section>/)?.[1];

  assert.ok(changelog, "expected a two-entry changelog");
  assert.equal((changelog.match(/class="release-entry reveal"/g) ?? []).length, 2);
  assert.match(changelog, /v0\.5\.9-firefly\.alpha\.77[\s\S]*?<h4>阅读、书架、壁纸与传书体验优化<\/h4>/);
  assert.match(changelog, /版本撤回：出现翻页卡顿 bug，等待修复/);
  assert.match(changelog, /v0\.5\.0-firefly\.alpha\.71[\s\S]*?<h4>阅读排版与 TXT 目录优化<\/h4>/);
  assert.doesNotMatch(changelog, /v0\.5\.0-firefly\.alpha\.70/);
  assert.doesNotMatch(changelog, /v0\.5\.0-firefly\.alpha\.69/);
  assert.doesNotMatch(changelog, /v0\.5\.0-firefly\.alpha\.56/);
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

test("the header hides on upward swipes and returns on reverse scrolling", async () => {
  const { getHeaderVisibility } = await import(new URL("src/header-visibility.js", projectRoot));

  assert.equal(
    getHeaderVisibility({ currentScrollY: 320, previousScrollY: 200, headerHeight: 88 }),
    "hidden",
  );
  assert.equal(
    getHeaderVisibility({ currentScrollY: 200, previousScrollY: 320, headerHeight: 88 }),
    "visible",
  );
});

test("the header stays available near the top and while navigation is in use", async () => {
  const { getHeaderVisibility } = await import(new URL("src/header-visibility.js", projectRoot));

  assert.equal(
    getHeaderVisibility({ currentScrollY: 60, previousScrollY: 0, headerHeight: 88 }),
    "visible",
  );
  assert.equal(
    getHeaderVisibility({ currentScrollY: 320, previousScrollY: 200, headerHeight: 88, locked: true }),
    "visible",
  );
  assert.equal(
    getHeaderVisibility({ currentScrollY: 204, previousScrollY: 200, headerHeight: 88 }),
    "unchanged",
  );
});

test("editorial motion reveals copy, image masks and grouped items with one rhythm", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const css = await readFile(new URL("src/styles.css", projectRoot), "utf8");
  const main = await readFile(new URL("src/main.js", projectRoot), "utf8");

  assert.match(html, /class="hero-copy reveal reveal-sequence"/);
  assert.match(html, /class="hero-visual reveal reveal-clip"/);
  assert.match(html, /class="advantage-list" data-reveal-group/);
  assert.match(html, /class="screen-gallery" data-reveal-group/);
  assert.match(css, /--motion-reveal:\s*960ms;/);
  assert.match(css, /--motion-image:\s*1500ms;/);
  assert.match(css, /--motion-ease:\s*cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\);/);
  assert.match(css, /\.js \.reveal-sequence > :nth-child\(4\)\s*\{\s*transition-delay:\s*420ms;/);
  assert.match(css, /\.js \.reveal-clip \.screen-frame\s*\{[^}]*clip-path:\s*inset\(0 0 100%\);/s);
  assert.match(css, /transition:\s*clip-path 1400ms var\(--motion-ease\);/);
  assert.match(css, /transition-delay:\s*calc\(var\(--reveal-delay, 0ms\) \+ 260ms\);/);
  assert.match(css, /transition:\s*transform 1100ms var\(--motion-ease\);/);
  assert.match(css, /\.js \.screen-card\.reveal-clip\[data-visible\] \.screen-frame:hover img\s*\{[^}]*transform:\s*scale\(1\.018\);/s);
  assert.match(main, /setProperty\("--reveal-delay",\s*`\$\{Math\.min\(index, 5\) \* 90\}ms`\)/);
});

test("editorial motion resolves immediately when reduced motion is requested", async () => {
  const css = await readFile(new URL("src/styles.css", projectRoot), "utf8");
  const reducedMotion = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));

  assert.match(reducedMotion, /\.js \.reveal-sequence > \*/);
  assert.match(reducedMotion, /\.js \.reveal-clip \.screen-frame/);
  assert.match(reducedMotion, /clip-path:\s*none/);
});

test("the release catalog supports three AuraReader versions and an official demo", async () => {
  const service = await readFile(new URL("src/release-service.js", projectRoot), "utf8");
  const flasher = await readFile(new URL("src/web-flasher.js", projectRoot), "utf8");

  assert.match(service, /slice\(0,\s*3\)/);
  assert.match(flasher, /data-version-options/);
  assert.match(flasher, /setReleases/);
  assert.match(flasher, /findReleaseByFirmwareVersion/);
  assert.doesNotMatch(flasher, /const FIRMWARE_URL/);
});

test("release catalog normalization keeps only valid installable entries", async () => {
  const { parseReleaseCatalog } = await import(new URL("src/release-service.js", projectRoot));
  const releases = parseReleaseCatalog({
    releases: [
      { codename: "Spark", version: "0.3.0", firmwareVersion: "v0.3.0-Spark", channel: "stable", displayName: "官方演示 Demo", description: "硬件功能演示与自检", badge: "官方演示", path: "./firmware/v0.3.0/full.bin", size: 4, sha256: "a".repeat(64) },
      { codename: "firefly", version: "0.2.0", channel: "beta", path: "./firmware/v0.2.0/full.bin", installable: false },
      { codename: "firefly", version: "0.1.0", firmwareVersion: "v0.1.0-firefly.alpha.1", channel: "alpha.1", path: "./firmware/v0.1.0/full.bin", size: 4, sha256: "b".repeat(64) },
    ],
  });

  assert.equal(releases.length, 2);
  assert.deepEqual(releases.map(({ version }) => version), ["0.3.0", "0.1.0"]);
  assert.deepEqual(releases.map(({ codename }) => codename), ["Spark", "firefly"]);
  assert.equal(releases[0].path, "./firmware/v0.3.0/full.bin");
  assert.equal(releases[0].label, "官方演示 Demo");
  assert.equal(releases[0].description, "硬件功能演示与自检");
  assert.equal(releases[0].badge, "官方演示");
  assert.equal(releases[1].firmwareVersion, "v0.1.0-firefly.alpha.1");
  assert.equal(releases[1].size, 4);
  assert.equal(releases[1].sha256, "b".repeat(64));
});

test("catalog keeps the latest and two rollback builds plus the official demo", async () => {
  const { parseReleaseCatalog } = await import(new URL("src/release-service.js", projectRoot));
  const make = (number) => ({ codename: "firefly", version: "0.5.0", firmwareVersion: `v0.5.0-firefly.alpha.${number}`, channel: `alpha.${number}`, path: `./firmware/alpha.${number}.bin`, size: 4, sha256: "a".repeat(64) });
  const demo = { ...make(1), codename: "official-demo", firmwareVersion: "Read-Pico-demo", channel: "official" };
  const releases = parseReleaseCatalog({ releases: [make(77), make(71), make(70), make(69), demo] });
  assert.deepEqual(releases.map(({ firmwareVersion }) => firmwareVersion), ["v0.5.0-firefly.alpha.77", "v0.5.0-firefly.alpha.71", "v0.5.0-firefly.alpha.70", "Read-Pico-demo"]);
});

test("the flasher labels releases with codename and version", async () => {
  const flasher = await readFile(new URL("src/web-flasher.js", projectRoot), "utf8");

  assert.match(flasher, /release\.label/);
  assert.doesNotMatch(flasher, /`AuraReader v\$\{release\.version\}`/);
});
