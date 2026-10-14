import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("the web flasher publishes one complete ESP32-S3 image", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("firmware/manifest.json", projectRoot), "utf8"),
  );
  const build = manifest.builds.find((item) => item.chipFamily === "ESP32-S3");

  assert.equal(manifest.name, "AuraReader");
  assert.equal(manifest.version, "0.1.0");
  assert.ok(build, "expected an ESP32-S3 build");
  assert.deepEqual(build.parts, [
    { path: "v0.1.0/aurareader-v0.1.0.bin", offset: 0 },
  ]);

  const imageUrl = new URL(`firmware/${build.parts[0].path}`, projectRoot);
  await access(imageUrl);
  assert.ok((await stat(imageUrl)).size > 0x910000, "merged image must include the font partition");
});

test("the merged image matches the verified release artifact", async () => {
  const image = await readFile(
    new URL("firmware/v0.1.0/aurareader-v0.1.0.bin", projectRoot),
  );
  const digest = createHash("sha256").update(image).digest("hex");

  assert.equal(image[0], 0xe9, "expected an ESP image header");
  assert.equal(digest, "76d382874ef211e15cde34f42bf55abe4e5e04ddf49554e545fc3fda89729ef8");
});

test("the flasher uses an inline guided flow instead of the ESP Web Tools dialog", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const main = await readFile(new URL("src/main.js", projectRoot), "utf8");
  const flasher = await readFile(new URL("src/web-flasher.js", projectRoot), "utf8");

  assert.doesNotMatch(html, /esp-web-install-button|esp-web-tools@/);
  assert.match(html, /data-flash-mode="install"/);
  assert.match(html, /data-flash-mode="console"/);
  assert.match(html, /name="erase-mode"[^>]+value="standard"[^>]+checked/s);
  assert.match(html, /name="erase-mode"[^>]+value="full"/s);
  assert.match(html, /id="flash-confirmation"/);
  assert.match(html, /id="flash-live-status"[^>]+role="status"/s);
  assert.match(main, /setupWebFlasher/);
  assert.match(flasher, /navigator\.serial\.requestPort/);
  assert.match(flasher, /ESPLoader/);
  assert.match(flasher, /eraseAll[,}]/);
  assert.match(flasher, /writeFlash/);
  assert.match(flasher, /after\("hard_reset"\)/);
});

test("the inline flasher exposes testable safety gating", async () => {
  const { canStartInstall } = await import(new URL("src/web-flasher.js", projectRoot));

  assert.equal(
    canStartInstall({ releaseReady: true, browserSupported: true, confirmed: true, busy: false }),
    true,
  );
  assert.equal(
    canStartInstall({ releaseReady: true, browserSupported: true, confirmed: false, busy: false }),
    false,
  );
  assert.equal(
    canStartInstall({ releaseReady: true, browserSupported: true, confirmed: true, busy: true }),
    false,
  );
});

test("the guided steps keep a stable work area and aligned actions", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const css = await readFile(new URL("src/styles.css", projectRoot), "utf8");

  assert.match(html, /data-flow-marker="mode"[^>]*><span>01<\/span>开始安装<\/li>/);
  assert.doesNotMatch(html, /class="safety-note/);
  assert.doesNotMatch(html, /重要提示/);
  assert.match(css, /\.flash-workbench\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s);
  assert.match(css, /\.flash-flow\s*\{[^}]*min-height:\s*44rem;[^}]*display:\s*grid;/s);
  assert.match(css, /\.flash-panel:not\(\[hidden\]\)\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
  assert.match(css, /\.flash-panel-actions\s*\{[^}]*margin-top:\s*auto;/s);
});

test("production builds copy the firmware tree into dist", async () => {
  const buildScript = await readFile(new URL("scripts/copy-static.mjs", projectRoot), "utf8");
  assert.match(buildScript, /cp\(source, destination, \{ recursive: true \}\)/);
});
