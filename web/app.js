(function () {
  "use strict";

  const status = document.getElementById("status");
  const button = document.getElementById("scanButton");
  const buttonLabel = document.getElementById("buttonLabel");
  const scannerWindow = document.getElementById("scannerWindow");
  const galleryButton = document.getElementById("galleryButton");
  let busy = false;
  let hasScanned = false;

  function plugin(name) {
    return window.Capacitor && window.Capacitor.Plugins
      ? window.Capacitor.Plugins[name]
      : null;
  }

  function isNative() {
    return Boolean(window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() !== "web");
  }

  function safeSurveyUrl(rawValue) {
    const value = String(rawValue || "").trim();
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }

  function setState(message, state) {
    status.textContent = message;
    scannerWindow.classList.toggle("is-busy", state === "busy");
    scannerWindow.classList.toggle("has-error", state === "error");
    status.classList.toggle("error", state === "error");
    button.disabled = state === "busy";
    galleryButton.disabled = state === "busy";
    buttonLabel.textContent = state === "busy" ? "掃描中…" : hasScanned ? "再掃一份" : "開始掃描";
  }

  async function openAutofilledSurvey(rawValue, sourceLabel) {
    const url = safeSurveyUrl(rawValue);
    if (!url) {
      setState(`${sourceLabel} QR Code 不是安全的 HTTPS 表單網址`, "error");
      return false;
    }

    const autofill = plugin("FormAutofill");
    if (!autofill) {
      setState("自動填寫元件尚未載入，請重新開啟 App", "error");
      return false;
    }

    setState("正在讀取題目並自動填寫…", "busy");
    await autofill.open({ url });
    hasScanned = true;
    setState("已開啟並自動填寫；請檢查後自行提交", "ready");
    return true;
  }

  async function startScan() {
    if (busy) return;
    if (!isNative()) {
      setState("請安裝 Android APK 後使用相機掃描功能", "error");
      return;
    }

    const scanner = plugin("CapacitorBarcodeScanner");
    if (!scanner || !plugin("FormAutofill")) {
      setState("掃描或自動填寫元件尚未載入，請重新開啟 App", "error");
      return;
    }

    busy = true;
    setState("正在開啟相機…", "busy");

    try {
      const result = await scanner.scanBarcode({
        hint: 0,
        scanInstructions: "將 QR Code 放入框內",
        scanButton: false,
        scanText: "掃描",
        cameraDirection: 1,
        scanOrientation: 3,
        cancelButtonAccessibilityLabel: "取消掃描",
        torchButtonOnAccessibilityLabel: "關閉手電筒",
        torchButtonOffAccessibilityLabel: "開啟手電筒",
        android: { scanningLibrary: "zxing" }
      });

      if (!result || !result.ScanResult) {
        setState("已取消，準備好可再次掃描", "ready");
        return;
      }
      await openAutofilledSurvey(result.ScanResult, "相機掃到的");
    } catch (error) {
      const message = error && error.message ? error.message : String(error || "");
      if (/cancel/i.test(message)) setState("已取消，準備好可再次掃描", "ready");
      else setState("無法啟動掃描器，請確認相機權限後再試一次", "error");
    } finally {
      busy = false;
      button.disabled = false;
      galleryButton.disabled = false;
      buttonLabel.textContent = hasScanned ? "再掃一份" : "開始掃描";
      scannerWindow.classList.remove("is-busy");
    }
  }

  async function scanGalleryImage() {
    if (busy) return;
    if (!isNative()) {
      setState("請安裝 Android APK 後使用圖庫辨識功能", "error");
      return;
    }

    const galleryQr = plugin("GalleryQr");
    if (!galleryQr || !plugin("FormAutofill")) {
      setState("圖庫辨識元件尚未載入，請重新開啟 App", "error");
      return;
    }

    busy = true;
    setState("請從圖庫選擇 QR Code 圖片…", "busy");

    try {
      const result = await galleryQr.scanImage();
      if (!result || result.cancelled) {
        setState("已取消選圖，準備好可再次掃描", "ready");
        return;
      }
      await openAutofilledSurvey(result.ScanResult, "圖片中的");
    } catch (error) {
      const code = String(error && error.code || "");
      const message = String(error && error.message || error || "");
      if (code === "NO_QR_CODE" || /找不到 QR Code/i.test(message)) {
        setState("這張圖片裡找不到 QR Code，請換一張清楚的圖片", "error");
      } else {
        setState("無法辨識圖片，請換一張 QR Code 圖片再試一次", "error");
      }
    } finally {
      busy = false;
      button.disabled = false;
      galleryButton.disabled = false;
      buttonLabel.textContent = hasScanned ? "再掃一份" : "開始掃描";
      scannerWindow.classList.remove("is-busy");
    }
  }

  button.addEventListener("click", startScan);
  galleryButton.addEventListener("click", scanGalleryImage);
})();
