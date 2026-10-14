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

test("the installer is gated by browser support and all safety confirmations", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const main = await readFile(new URL("src/main.js", projectRoot), "utf8");

  assert.match(html, /esp-web-tools@10\/dist\/web\/install-button\.js\?module/);
  assert.match(html, /<esp-web-install-button[^>]+manifest="\.\/firmware\/manifest\.json"/s);
  assert.match(html, /id="flash-button"[^>]+slot="activate"/s);
  assert.doesNotMatch(html, /<fieldset class="checklist" disabled>/);
  assert.match(main, /inputs\.every\(\(input\) => input\.checked\)/);
  assert.match(main, /"serial" in navigator/);
  assert.match(main, /window\.isSecureContext/);
});

test("production builds copy the firmware tree into dist", async () => {
  const buildScript = await readFile(new URL("scripts/copy-static.mjs", projectRoot), "utf8");
  assert.match(buildScript, /cp\(source, destination, \{ recursive: true \}\)/);
});
