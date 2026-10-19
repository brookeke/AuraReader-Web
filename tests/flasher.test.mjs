import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("the web flasher publishes AuraReader and the official demo as complete ESP32-S3 images", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("firmware/manifest.json", projectRoot), "utf8"),
  );
  const [auraReader, officialDemo] = manifest.releases;
  const build = auraReader.builds.find((item) => item.chipFamily === "ESP32-S3");
  const demoBuild = officialDemo.builds.find((item) => item.chipFamily === "ESP32-S3");

  assert.equal(manifest.state, "available");
  assert.equal(manifest.releases.length, 2);
  assert.equal(auraReader.name, "AuraReader");
  assert.equal(auraReader.codename, "firefly");
  assert.equal(auraReader.version, "0.5.0");
  assert.equal(auraReader.firmwareVersion, "v0.5.0-firefly.alpha.36");
  assert.equal(auraReader.installable, true);
  assert.equal(auraReader.channel, "alpha.36");
  assert.equal(auraReader.size, 0x1000000);
  assert.match(auraReader.sha256, /^[a-f0-9]{64}$/);
  assert.ok(build, "expected an ESP32-S3 build");
  assert.deepEqual(build.parts, [
    {
      path: "v0.5.0-firefly.alpha.36/AuraReader-v0.5.0-firefly.alpha.36-full-16MB.bin",
      offset: 0,
    },
  ]);

  assert.equal(officialDemo.name, "小纸 Pico");
  assert.equal(officialDemo.displayName, "小纸 Pico 官方演示 Demo");
  assert.equal(officialDemo.description, "硬件功能演示与自检");
  assert.equal(officialDemo.sourceRevision, "6a247cc94420b85c650b32a6b2c063a360070eee");
  assert.equal(officialDemo.installable, true);
  assert.equal(officialDemo.size, 0x1000000);
  assert.ok(demoBuild, "expected an official demo ESP32-S3 build");

  for (const release of [auraReader, officialDemo]) {
    const releaseBuild = release.builds.find((item) => item.chipFamily === "ESP32-S3");
    const imageUrl = new URL(`firmware/${releaseBuild.parts[0].path}`, projectRoot);
    const image = await readFile(imageUrl);
    const digest = createHash("sha256").update(image).digest("hex");
    assert.equal(image[0], 0xe9, "expected an ESP image header");
    assert.equal((await stat(imageUrl)).size, 0x1000000, "release image must be exactly 16 MiB");
    assert.equal(digest, release.sha256, "release image must match its manifest digest");
  }
});

test("the verified rollback alpha.36 release can enter the flashing flow", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const styles = await readFile(new URL("src/styles.css", projectRoot), "utf8");
  const main = await readFile(new URL("src/main.js", projectRoot), "utf8");
  const flasher = await readFile(new URL("src/web-flasher.js", projectRoot), "utf8");
  const { parseReleaseAvailability } = await import(
    new URL("src/release-service.js", projectRoot)
  );

  const availability = parseReleaseAvailability({
    name: "AuraReader",
    codename: "firefly",
    version: "0.5.0",
    state: "available",
    installable: true,
    channel: "alpha.36",
    firmwareVersion: "v0.5.0-firefly.alpha.36",
    size: 0x1000000,
    sha256: "1".repeat(64),
    builds: [{
      chipFamily: "ESP32-S3",
      parts: [{
        path: "v0.5.0-firefly.alpha.36/AuraReader-v0.5.0-firefly.alpha.36-full-16MB.bin",
        offset: 0,
      }],
    }],
  });

  assert.deepEqual(availability, {
    state: "available",
    codename: "firefly",
    version: "0.5.0",
    releases: [{
      codename: "firefly",
      version: "0.5.0",
      firmwareVersion: "v0.5.0-firefly.alpha.36",
      label: "firefly v0.5.0 alpha.36",
      description: "严格 16 MiB 完整固件",
      badge: "",
      publishedAt: null,
      channel: "alpha.36",
      chipFamily: "ESP32-S3",
      path: "./firmware/v0.5.0-firefly.alpha.36/AuraReader-v0.5.0-firefly.alpha.36-full-16MB.bin",
      size: 0x1000000,
      sha256: "1".repeat(64),
    }],
  });
  assert.match(html, /id="release-status">正在读取固件状态/);
  assert.match(html, /class="flash-product-name">AuraReader<\/span>/);
  assert.match(html, /class="flash-release-identity">\s*<span id="flash-release-codename">firefly<\/span>\s*<span id="flash-release-version">v0\.5\.0<\/span>\s*<span id="flash-release-channel">alpha\.36<\/span>/s);
  assert.match(styles, /\.flash-release-identity\s*\{[^}]*font-size:\s*clamp\(1\.35rem,\s*2vw,\s*2rem\)/s);
  assert.match(main, /availability\.codename/);
  assert.match(html, /data-flow-next="erase"[^>]+disabled[^>]*>请先选择设备/s);
  assert.match(main, /availability\.state === "suspended"/);
  assert.match(flasher, /destination === "erase"[\s\S]*?!canAdvanceFromVersion/);
});

test("the merged image matches the verified release artifact", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("firmware/manifest.json", projectRoot), "utf8"),
  );
  const [release] = manifest.releases;
  const image = await readFile(
    new URL("firmware/v0.5.0-firefly.alpha.36/AuraReader-v0.5.0-firefly.alpha.36-full-16MB.bin", projectRoot),
  );
  const digest = createHash("sha256").update(image).digest("hex");

  assert.equal(image[0], 0xe9, "expected an ESP image header");
  assert.equal(image.length, 0x1000000);
  assert.equal(digest, release.sha256);
});

test("downloaded firmware must match the release size, image header and sha256", async () => {
  const { validateFirmwareImage } = await import(new URL("src/web-flasher.js", projectRoot));
  const firmware = new Uint8Array([0xe9, 0x03, 0x02, 0x4f]);
  const release = {
    size: firmware.length,
    sha256: createHash("sha256").update(firmware).digest("hex"),
  };

  await assert.doesNotReject(validateFirmwareImage(firmware, release));
  await assert.rejects(validateFirmwareImage(firmware, { ...release, size: 5 }), /大小校验失败/);
  await assert.rejects(validateFirmwareImage(firmware, { ...release, sha256: "0".repeat(64) }), /SHA-256 校验失败/);
  await assert.rejects(validateFirmwareImage(new Uint8Array([0, 1, 2, 3]), release), /ESP 镜像/);
});

test("the flasher uses an inline guided flow instead of the ESP Web Tools dialog", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const main = await readFile(new URL("src/main.js", projectRoot), "utf8");
  const flasher = await readFile(new URL("src/web-flasher.js", projectRoot), "utf8");

  assert.doesNotMatch(html, /esp-web-install-button|esp-web-tools@/);
  assert.match(html, /id="flash-version-title"[^>]*>连接设备并选择固件<\/h4>/);
  assert.doesNotMatch(html, /name="firmware-version"[^>]+value="0\.1\.0"/s);
  assert.match(html, /正在读取可用固件/);
  assert.doesNotMatch(html, /flash-mode|data-flash-panel="console"|串口日志/);
  assert.doesNotMatch(flasher, /consoleButton|disconnectConsole|serialReader/);
  assert.match(html, /name="erase-mode"[^>]+value="overwrite"[^>]+checked/s);
  assert.match(html, /name="erase-mode"[^>]+value="erase"/s);
  assert.match(html, /id="flash-confirmation"/);
  assert.match(html, /id="flash-live-status"[^>]+role="status"/s);
  assert.match(main, /setupWebFlasher/);
  assert.match(flasher, /navigator\.serial\.requestPort/);
  assert.match(flasher, /ESPLoader/);
  assert.match(flasher, /eraseAll[,}]/);
  assert.match(flasher, /writeFlash/);
  assert.match(flasher, /after\("hard_reset"\)/);
  assert.match(flasher, /detectFlashSize\(\)/);
  assert.match(flasher, /detectedFlashSize !== "16MB"/);
  assert.match(flasher, /validateFirmwareImage\(firmware, selectedRelease\)/);
  assert.match(flasher, /flashMode:\s*"keep"/);
  assert.match(flasher, /flashFreq:\s*"keep"/);
  assert.match(flasher, /flashSize:\s*"keep"/);
  assert.match(flasher, /compress:\s*false/);
  assert.match(html, /设备内部数据将被覆盖/);
  assert.doesNotMatch(html, /保留可保留的数据/);
});

test("the inline flasher exposes testable safety gating", async () => {
  const { canAdvanceFromVersion, canStartInstall } = await import(
    new URL("src/web-flasher.js", projectRoot)
  );

  assert.equal(
    canAdvanceFromVersion({ releaseReady: true, browserSupported: true, deviceSelected: false, busy: false }),
    false,
  );
  assert.equal(
    canAdvanceFromVersion({ releaseReady: true, browserSupported: true, deviceSelected: true, busy: false }),
    true,
  );

  assert.equal(
    canStartInstall({ releaseReady: true, browserSupported: true, deviceSelected: true, confirmed: true, busy: false }),
    true,
  );
  assert.equal(
    canStartInstall({ releaseReady: true, browserSupported: true, deviceSelected: false, confirmed: true, busy: false }),
    false,
  );
  assert.equal(
    canStartInstall({ releaseReady: true, browserSupported: true, deviceSelected: true, confirmed: false, busy: false }),
    false,
  );
  assert.equal(
    canStartInstall({ releaseReady: true, browserSupported: true, deviceSelected: true, confirmed: true, busy: true }),
    false,
  );
});

test("the first step must select a serial device before firmware choices can advance", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const flasher = await readFile(new URL("src/web-flasher.js", projectRoot), "utf8");

  assert.match(html, /id="flash-version-title"[^>]*>连接设备并选择固件<\/h4>/);
  assert.match(html, /id="flash-device-button"[^>]*>选择 AuraReader 设备<\/button>/);
  assert.match(html, /id="flash-device-status"[^>]+role="status"[^>]*>尚未选择设备<\/p>/s);
  assert.match(html, /data-flow-next="erase"[^>]+disabled/s);
  assert.match(flasher, /deviceButton\?\.addEventListener\("click", async \(\) =>/);
  assert.match(flasher, /selectedPort = await navigator\.serial\.requestPort\(\)/);
  assert.match(flasher, /const port = selectedPort;/);
  assert.doesNotMatch(flasher, /flashButton\?\.addEventListener\([\s\S]*?const port = await navigator\.serial\.requestPort\(\)/);
});

test("the guided steps keep a stable work area and aligned actions", async () => {
  const html = await readFile(new URL("index.html", projectRoot), "utf8");
  const css = await readFile(new URL("src/styles.css", projectRoot), "utf8");
  const mobileCss = css.slice(css.indexOf("@media (max-width: 620px)"));

  assert.match(html, /data-flow-marker="version"[^>]*><span>01<\/span>开始安装<\/li>/);
  assert.doesNotMatch(html, /class="safety-note/);
  assert.doesNotMatch(html, /重要提示/);
  assert.match(css, /\.flash-workbench\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s);
  assert.match(css, /\.flash-flow\s*\{[^}]*min-height:\s*52rem;[^}]*height:\s*52rem;[^}]*display:\s*grid;/s);
  assert.match(css, /\.flash-panel:not\(\[hidden\]\)\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
  assert.match(css, /\.flash-panel-actions\s*\{[^}]*margin-top:\s*auto;/s);
  assert.match(mobileCss, /\.flash-flow\s*\{[^}]*min-height:\s*60rem;[^}]*height:\s*60rem;/s);
});

test("production builds copy the firmware tree into dist", async () => {
  const buildScript = await readFile(new URL("scripts/copy-static.mjs", projectRoot), "utf8");
  assert.match(buildScript, /cp\(source, destination, \{ recursive: true \}\)/);
});

