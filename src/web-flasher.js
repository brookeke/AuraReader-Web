const ESPTOOL_MODULE_URL = "https://unpkg.com/esptool-js@0.6.1/bundle.js";

export function canAdvanceFromVersion({ releaseReady, browserSupported, deviceSelected, busy }) {
  return releaseReady && browserSupported && deviceSelected && !busy;
}

export function canStartInstall({ releaseReady, browserSupported, deviceSelected, confirmed, busy }) {
  return releaseReady && browserSupported && deviceSelected && confirmed && !busy;
}

async function sha256Hex(bytes) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateFirmwareImage(firmware, release) {
  if (!(firmware instanceof Uint8Array) || firmware[0] !== 0xe9) {
    throw new Error("下载内容不是有效的 ESP 镜像，已停止写入。");
  }
  if (firmware.length !== release.size) {
    throw new Error(`固件大小校验失败：应为 ${release.size} 字节，实际为 ${firmware.length} 字节。`);
  }
  const digest = await sha256Hex(firmware);
  if (digest !== release.sha256) {
    throw new Error("固件 SHA-256 校验失败，已停止写入。请刷新页面后重试。");
  }
}

function hasWebSerial() {
  return typeof navigator !== "undefined" && "serial" in navigator && window.isSecureContext;
}

function errorMessage(error) {
  if (error?.name === "NotFoundError") return "未选择设备。你可以重新点击并选择 AuraReader 的串口。";
  if (error?.name === "NetworkError") return "串口正被其他程序占用。关闭串口工具后再试。";
  return error instanceof Error ? error.message : "操作未完成，请检查连接后重试。";
}

export function setupWebFlasher() {
  const root = document.querySelector("[data-flasher]");
  if (!root) return { setReleases() {} };

  const flow = root.querySelector("[data-flash-flow]");
  const panels = [...root.querySelectorAll("[data-flash-panel]")];
  const markers = [...root.querySelectorAll("[data-flow-marker]")];
  const eraseInputs = [...root.querySelectorAll("[name='erase-mode']")];
  const versionOptions = root.querySelector("[data-version-options]");
  const versionNextButton = root.querySelector('[data-flow-next="erase"]');
  const deviceButton = root.querySelector("#flash-device-button");
  const deviceStatus = root.querySelector("#flash-device-status");
  const versionSummary = root.querySelector("[data-version-summary]");
  const deviceSummary = root.querySelector("[data-device-summary]");
  const confirmation = root.querySelector("#flash-confirmation");
  const flashButton = root.querySelector("#flash-button");
  const liveStatus = root.querySelector("#flash-live-status");
  const browserStatus = root.querySelector("#browser-status");
  const eraseSummary = root.querySelector("[data-erase-summary]");
  const progressItems = [...root.querySelectorAll("[data-flash-progress]")];
  const browserSupported = hasWebSerial();
  let releaseReady = false;
  let busy = false;
  let releases = [];
  let selectedRelease = null;
  let selectedPort = null;

  browserStatus.textContent = browserSupported ? "浏览器支持 Web Serial" : "请使用桌面版 Chrome 或 Edge";
  browserStatus.toggleAttribute("data-supported", browserSupported);

  function selectedValue(inputs) {
    return inputs.find((input) => input.checked)?.value;
  }

  function selectRelease(version) {
    selectedRelease = releases.find((release) => release.version === version) ?? releases[0] ?? null;
    if (versionSummary) {
      versionSummary.textContent = selectedRelease ? selectedRelease.label : "—";
    }
  }

  function updateVersionStep() {
    const canAdvance = canAdvanceFromVersion({
      releaseReady,
      browserSupported,
      deviceSelected: Boolean(selectedPort),
      busy,
    });
    if (deviceButton) {
      deviceButton.disabled = !browserSupported || busy;
      deviceButton.classList.toggle("button-disabled", !browserSupported || busy);
      deviceButton.classList.toggle("button-dark", browserSupported && !busy);
      if (busy) deviceButton.textContent = "正在打开设备列表";
      else if (!browserSupported) deviceButton.textContent = "当前浏览器不支持";
      else deviceButton.textContent = selectedPort ? "重新选择设备" : "选择 AuraReader 设备";
    }
    if (versionNextButton) {
      versionNextButton.disabled = !canAdvance;
      versionNextButton.classList.toggle("button-disabled", !canAdvance);
      versionNextButton.classList.toggle("button-dark", canAdvance);
      if (!releaseReady) versionNextButton.textContent = "烧录已暂停";
      else if (!browserSupported) versionNextButton.textContent = "浏览器不支持";
      else if (!selectedPort) versionNextButton.textContent = "请先选择设备";
      else versionNextButton.textContent = "下一步 →";
    }
  }

  function renderReleaseOptions(nextReleases) {
    releases = nextReleases.slice(0, 2);
    selectedRelease = releases[0] ?? null;
    if (!versionOptions) return;
    versionOptions.replaceChildren();

    releases.forEach((release, index) => {
      const label = document.createElement("label");
      label.className = "flash-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "firmware-version";
      input.value = release.version;
      input.dataset.firmwareVersion = release.version;
      input.checked = index === 0;
      input.addEventListener("change", () => selectRelease(input.value));

      const copy = document.createElement("span");
      copy.className = "option-copy";
      const title = document.createElement("strong");
      title.textContent = release.label;
      const description = document.createElement("small");
      description.textContent = "严格 16 MiB 完整固件";
      copy.append(title, description);

      const tag = document.createElement("span");
      tag.className = "option-tag";
      tag.textContent = index === 0 ? "当前版本" : "可安装";
      label.append(input, copy, tag);
      versionOptions.append(label);
    });

    if (releases.length === 0) {
      const unavailable = document.createElement("p");
      unavailable.className = "release-unavailable";
      unavailable.textContent = "当前没有可安装固件。";
      versionOptions.append(unavailable);
    }
    selectRelease(selectedRelease?.version);
    updateVersionStep();
  }

  function showPanel(name) {
    panels.forEach((panel) => panel.toggleAttribute("hidden", panel.dataset.flashPanel !== name));
    const order = ["version", "erase", "confirm"].indexOf(name) + 1;
    markers.forEach((marker, index) => {
      if (index + 1 === order) marker.setAttribute("aria-current", "step");
      else marker.removeAttribute("aria-current");
      marker.toggleAttribute("data-complete", index + 1 < order);
    });
    flow?.setAttribute("data-active-panel", name);
    panels.find((panel) => panel.dataset.flashPanel === name)?.querySelector("h4")?.focus?.({ preventScroll: true });
  }

  function updateInstallButton() {
    const enabled = canStartInstall({
      releaseReady,
      browserSupported,
      deviceSelected: Boolean(selectedPort),
      confirmed: Boolean(confirmation?.checked),
      busy,
    });
    flashButton.disabled = !enabled;
    flashButton.classList.toggle("button-disabled", !enabled);
    flashButton.classList.toggle("button-dark", enabled);
    if (busy) flashButton.textContent = "正在处理，请勿断开";
    else if (!browserSupported) flashButton.textContent = "当前浏览器不支持";
    else if (!releaseReady) flashButton.textContent = "固件暂不可用";
    else if (!selectedPort) flashButton.textContent = "请先选择设备";
    else flashButton.textContent = enabled ? "开始写入" : "确认后开始";
  }

  function resetProgress() {
    progressItems.forEach((item) => {
      item.removeAttribute("data-state");
      item.removeAttribute("aria-current");
    });
  }

  function setProgress(name, state = "active") {
    const currentIndex = progressItems.findIndex((item) => item.dataset.flashProgress === name);
    progressItems.forEach((item, index) => {
      if (index < currentIndex) item.dataset.state = "complete";
      else if (index === currentIndex) item.dataset.state = state;
      else item.removeAttribute("data-state");
      if (index === currentIndex && state === "active") item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
  }

  function setLiveStatus(message, state = "") {
    liveStatus.textContent = message;
    if (state) liveStatus.dataset.state = state;
    else liveStatus.removeAttribute("data-state");
  }

  eraseInputs.forEach((input) => {
    input.addEventListener("change", () => {
      eraseSummary.textContent = input.value === "erase" ? "先擦除再完整覆盖" : "完整覆盖";
    });
  });

  deviceButton?.addEventListener("click", async () => {
    if (!browserSupported || busy) return;
    busy = true;
    updateVersionStep();
    updateInstallButton();
    deviceStatus.textContent = "请在系统窗口中选择 AuraReader 的串口。";
    deviceStatus.dataset.state = "working";

    try {
      selectedPort = await navigator.serial.requestPort();
      deviceStatus.textContent = "设备已选择，可以继续选择固件。";
      deviceStatus.dataset.state = "success";
      if (deviceSummary) deviceSummary.textContent = "已选择（写入前校验）";
      setProgress("connect", "complete");
    } catch (error) {
      selectedPort = null;
      deviceStatus.textContent = errorMessage(error);
      deviceStatus.dataset.state = "error";
      if (deviceSummary) deviceSummary.textContent = "尚未选择";
      resetProgress();
    } finally {
      busy = false;
      updateVersionStep();
      updateInstallButton();
    }
  });

  root.querySelectorAll("[data-flow-next]").forEach((button) => {
    button.addEventListener("click", () => {
      const destination = button.dataset.flowNext;
      if (
        destination === "erase" &&
        !canAdvanceFromVersion({
          releaseReady,
          browserSupported,
          deviceSelected: Boolean(selectedPort),
          busy,
        })
      ) return;
      showPanel(destination || "erase");
    });
  });

  root.querySelectorAll("[data-flow-back]").forEach((button) => {
    button.addEventListener("click", () => showPanel(button.dataset.flowBack));
  });

  confirmation?.addEventListener("change", updateInstallButton);

  flashButton?.addEventListener("click", async () => {
    if (
      !canStartInstall({
        releaseReady,
        browserSupported,
        deviceSelected: Boolean(selectedPort),
        confirmed: confirmation.checked,
        busy,
      }) ||
      !selectedRelease
    ) return;

    let transport;
    const port = selectedPort;
    busy = true;
    updateInstallButton();
    updateVersionStep();
    resetProgress();
    setProgress("check");
    setLiveStatus("正在连接第一步选择的设备…", "working");

    try {
      const { ESPLoader, Transport } = await import(/* @vite-ignore */ ESPTOOL_MODULE_URL);
      transport = new Transport(port, true);
      setLiveStatus("正在连接并识别芯片…", "working");
      const loader = new ESPLoader({
        transport,
        baudrate: 460800,
        debugLogging: false,
        terminal: {
          clean() {},
          write() {},
          writeLine(message) {
            if (/error|fail/i.test(message)) setLiveStatus(message, "error");
          },
        },
      });
      const chipName = await loader.main();
      if (!String(chipName).toUpperCase().includes("ESP32-S3")) {
        throw new Error(`检测到 ${chipName}，本固件仅适用于 ESP32-S3。`);
      }
      const detectedFlashSize = await loader.detectFlashSize();
      if (detectedFlashSize !== "16MB") {
        throw new Error(`检测到 ${detectedFlashSize || "未知容量"} Flash，本固件仅适用于 16MB 设备。`);
      }

      setLiveStatus("正在下载并校验固件完整性…", "working");
      const response = await fetch(new URL(selectedRelease.path, window.location.href));
      if (!response.ok) throw new Error(`固件下载失败（HTTP ${response.status}）。`);
      const firmware = new Uint8Array(await response.arrayBuffer());
      await validateFirmwareImage(firmware, selectedRelease);
      const eraseAll = selectedValue(eraseInputs) === "erase";

      setProgress("write");
      setLiveStatus("固件校验通过，开始写入完整镜像…", "working");
      await loader.writeFlash({
        fileArray: [{ data: firmware, address: 0 }],
        flashMode: "keep",
        flashFreq: "keep",
        flashSize: "keep",
        eraseAll,
        compress: false,
        reportProgress(_fileIndex, written, total) {
          const percent = Math.min(100, Math.round((written / total) * 100));
          setLiveStatus(`正在写入固件 ${percent}% · 请勿断开 USB`, "working");
        },
      });

      setProgress("verify");
      setLiveStatus("写入校验通过，正在重新启动设备…", "working");
      await loader.after("hard_reset");
      setProgress("done", "complete");
      setLiveStatus("AuraReader 已安装完成。设备正在重新启动。", "success");
    } catch (error) {
      const active = progressItems.find((item) => item.getAttribute("aria-current") === "step");
      if (active) active.dataset.state = "error";
      setLiveStatus(errorMessage(error), "error");
    } finally {
      if (transport) {
        try { await transport.disconnect(); } catch {}
      }
      busy = false;
      updateVersionStep();
      updateInstallButton();
    }
  });

  showPanel("version");
  updateInstallButton();

  return {
    setReleases(nextReleases) {
      renderReleaseOptions(Array.isArray(nextReleases) ? nextReleases : []);
      releaseReady = releases.length > 0;
      updateVersionStep();
      updateInstallButton();
    },
  };
}

