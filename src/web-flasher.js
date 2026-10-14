const ESPTOOL_MODULE_URL = "https://unpkg.com/esptool-js@0.6.1/bundle.js";
const FIRMWARE_URL = "./firmware/v0.1.0/aurareader-v0.1.0.bin";

export function canStartInstall({ releaseReady, browserSupported, confirmed, busy }) {
  return releaseReady && browserSupported && confirmed && !busy;
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
  if (!root) return { setReleaseReady() {} };

  const flow = root.querySelector("[data-flash-flow]");
  const panels = [...root.querySelectorAll("[data-flash-panel]")];
  const markers = [...root.querySelectorAll("[data-flow-marker]")];
  const eraseInputs = [...root.querySelectorAll("[name='erase-mode']")];
  const confirmation = root.querySelector("#flash-confirmation");
  const flashButton = root.querySelector("#flash-button");
  const liveStatus = root.querySelector("#flash-live-status");
  const browserStatus = root.querySelector("#browser-status");
  const eraseSummary = root.querySelector("[data-erase-summary]");
  const progressItems = [...root.querySelectorAll("[data-flash-progress]")];
  const browserSupported = hasWebSerial();
  let releaseReady = false;
  let busy = false;

  browserStatus.textContent = browserSupported ? "浏览器支持 Web Serial" : "请使用桌面版 Chrome 或 Edge";
  browserStatus.toggleAttribute("data-supported", browserSupported);

  function selectedValue(inputs) {
    return inputs.find((input) => input.checked)?.value;
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
      confirmed: Boolean(confirmation?.checked),
      busy,
    });
    flashButton.disabled = !enabled;
    flashButton.classList.toggle("button-disabled", !enabled);
    flashButton.classList.toggle("button-dark", enabled);
    if (busy) flashButton.textContent = "正在处理，请勿断开";
    else if (!browserSupported) flashButton.textContent = "当前浏览器不支持";
    else if (!releaseReady) flashButton.textContent = "固件暂不可用";
    else flashButton.textContent = enabled ? "选择设备并开始" : "确认后开始";
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
      eraseSummary.textContent = input.value === "full" ? "完整擦除后写入" : "标准写入";
    });
  });

  root.querySelectorAll("[data-flow-next]").forEach((button) => {
    button.addEventListener("click", () => {
      const destination = button.dataset.flowNext;
      showPanel(destination || "erase");
    });
  });

  root.querySelectorAll("[data-flow-back]").forEach((button) => {
    button.addEventListener("click", () => showPanel(button.dataset.flowBack));
  });

  confirmation?.addEventListener("change", updateInstallButton);

  flashButton?.addEventListener("click", async () => {
    if (!canStartInstall({ releaseReady, browserSupported, confirmed: confirmation.checked, busy })) return;

    let transport;
    busy = true;
    updateInstallButton();
    resetProgress();
    setProgress("connect");
    setLiveStatus("请在系统窗口中选择 AuraReader 设备。", "working");

    try {
      const port = await navigator.serial.requestPort();
      setProgress("check");
      setLiveStatus("正在连接并识别芯片…", "working");
      const { ESPLoader, Transport } = await import(/* @vite-ignore */ ESPTOOL_MODULE_URL);
      transport = new Transport(port, true);
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

      setProgress("write");
      setLiveStatus("正在下载固件并准备写入…", "working");
      const response = await fetch(new URL(FIRMWARE_URL, window.location.href));
      if (!response.ok) throw new Error(`固件下载失败（HTTP ${response.status}）。`);
      const firmware = new Uint8Array(await response.arrayBuffer());
      const eraseAll = selectedValue(eraseInputs) === "full";

      await loader.writeFlash({
        fileArray: [{ data: firmware, address: 0 }],
        flashMode: "dio",
        flashFreq: "80m",
        flashSize: "16MB",
        eraseAll,
        compress: true,
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
      updateInstallButton();
    }
  });

  showPanel("version");
  updateInstallButton();

  return {
    setReleaseReady(ready) {
      releaseReady = ready;
      updateInstallButton();
    },
  };
}

