(function () {
  "use strict";

  const status = document.getElementById("status");
  const button = document.getElementById("scanButton");
  const buttonLabel = document.getElementById("buttonLabel");
  const scannerWindow = document.getElementById("scannerWindow");
  const galleryButton = document.getElementById("galleryButton");
  const urlForm = document.getElementById("urlForm");
  const urlInput = document.getElementById("urlInput");
  const urlOpenButton = document.getElementById("urlOpenButton");
  const homePage = document.getElementById("homePage");
  const profilePage = document.getElementById("profilePage");
  const profileOpenButton = document.getElementById("profileOpenButton");
  const profileBackButton = document.getElementById("profileBackButton");
  const profileClearButton = document.getElementById("profileClearButton");
  const profileCount = document.getElementById("profileCount");
  const profileProgress = document.getElementById("profileProgress");
  const profileForm = document.getElementById("profileForm");
  const profileStatus = document.getElementById("profileStatus");
  const customRulesList = document.getElementById("customRulesList");
  const customRulesValue = document.getElementById("customRulesValue");
  const customRuleCount = document.getElementById("customRuleCount");
  const addCustomRuleButton = document.getElementById("addCustomRuleButton");
  const defaultTextAnswer = "無";
  const legacyDefaultAnswer = "這是由掃表自動產生並填入的回覆。";
  const personalProfileFields = ["name", "email", "university", "department", "grade", "studentId"];
  const profileFields = [...personalProfileFields, "defaultAnswer", "customRules"];
  const maxCustomRules = 12;
  const webProfileKey = "qr_survey_profile_v2";
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
    profileOpenButton.disabled = state === "busy";
    urlInput.disabled = state === "busy";
    urlOpenButton.disabled = state === "busy";
    buttonLabel.textContent = state === "busy" ? "掃描中…" : hasScanned ? "再掃一份" : "開始掃描";
  }

  function finishBusyState() {
    busy = false;
    button.disabled = false;
    galleryButton.disabled = false;
    profileOpenButton.disabled = false;
    urlInput.disabled = false;
    urlOpenButton.disabled = false;
    buttonLabel.textContent = hasScanned ? "再掃一份" : "開始掃描";
    scannerWindow.classList.remove("is-busy");
  }

  function normalizeCustomRules(rawRules) {
    let rules = rawRules;
    if (typeof rules === "string") {
      try {
        rules = JSON.parse(rules || "[]");
      } catch {
        rules = [];
      }
    }
    if (!Array.isArray(rules)) return [];
    return rules.slice(0, maxCustomRules).map((rule) => ({
      keyword: String(rule && rule.keyword || "").trim().slice(0, 120),
      reply: String(rule && (rule.reply ?? rule.response) || "").trim().slice(0, 500),
    })).filter((rule) => rule.keyword && rule.reply);
  }

  function normalizedProfile(rawProfile) {
    const profile = {};
    for (const field of profileFields) {
      profile[field] = field === "customRules"
        ? JSON.stringify(normalizeCustomRules(rawProfile && rawProfile[field]))
        : String(rawProfile && rawProfile[field] || "").trim();
    }
    if (!profile.defaultAnswer || profile.defaultAnswer === legacyDefaultAnswer) profile.defaultAnswer = defaultTextAnswer;
    return profile;
  }

  function profileFromForm() {
    const profile = Object.fromEntries(new FormData(profileForm).entries());
    profile.customRules = JSON.stringify(collectCustomRules(true));
    return normalizedProfile(profile);
  }

  function collectCustomRules(strict) {
    const rules = [];
    for (const row of customRulesList.querySelectorAll(".custom-rule-row")) {
      const keyword = row.querySelector(".custom-rule-keyword").value.trim();
      const reply = row.querySelector(".custom-rule-reply").value.trim();
      if (strict && Boolean(keyword) !== Boolean(reply)) {
        const missing = keyword ? row.querySelector(".custom-rule-reply") : row.querySelector(".custom-rule-keyword");
        missing.focus();
        throw new Error("每組自訂規則都要同時填寫關鍵詞與回覆。");
      }
      if (keyword && reply) rules.push({ keyword, reply });
    }
    return rules.slice(0, maxCustomRules);
  }

  function updateCustomRuleUi() {
    const rows = Array.from(customRulesList.querySelectorAll(".custom-rule-row"));
    const completed = rows.filter((row) => {
      return row.querySelector(".custom-rule-keyword").value.trim()
        && row.querySelector(".custom-rule-reply").value.trim();
    }).length;
    customRuleCount.textContent = `${completed}/${maxCustomRules}`;
    addCustomRuleButton.disabled = rows.length >= maxCustomRules;
  }

  function createCustomRuleRow(rule, index) {
    const row = document.createElement("article");
    row.className = "custom-rule-row";

    const head = document.createElement("div");
    head.className = "custom-rule-row-head";
    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    const title = document.createElement("b");
    title.textContent = "題目比對規則";
    const remove = document.createElement("button");
    remove.className = "custom-rule-remove";
    remove.type = "button";
    remove.setAttribute("aria-label", `刪除第 ${index + 1} 組規則`);
    remove.textContent = "刪除";
    head.append(number, title, remove);

    const keywordLabel = document.createElement("label");
    keywordLabel.className = "custom-rule-field";
    const keywordTitle = document.createElement("span");
    keywordTitle.textContent = "預設詞／題目關鍵詞";
    const keyword = document.createElement("input");
    keyword.className = "custom-rule-keyword";
    keyword.type = "text";
    keyword.maxLength = 120;
    keyword.placeholder = "例如：最喜歡的顏色、偏好顏色";
    keyword.value = rule.keyword || "";
    keywordLabel.append(keywordTitle, keyword);

    const replyLabel = document.createElement("label");
    replyLabel.className = "custom-rule-field";
    const replyTitle = document.createElement("span");
    replyTitle.textContent = "回覆";
    const reply = document.createElement("textarea");
    reply.className = "custom-rule-reply";
    reply.rows = 2;
    reply.maxLength = 500;
    reply.placeholder = "例如：綠色";
    reply.value = rule.reply || "";
    replyLabel.append(replyTitle, reply);

    row.append(head, keywordLabel, replyLabel);
    return row;
  }

  function renderCustomRules(rawRules) {
    const rules = normalizeCustomRules(rawRules);
    customRulesList.replaceChildren();
    const visibleRules = rules.length ? rules : [{ keyword: "", reply: "" }];
    visibleRules.forEach((rule, index) => customRulesList.append(createCustomRuleRow(rule, index)));
    customRulesValue.value = JSON.stringify(rules);
    updateCustomRuleUi();
  }

  function addCustomRule() {
    const count = customRulesList.querySelectorAll(".custom-rule-row").length;
    if (count >= maxCustomRules) return;
    const row = createCustomRuleRow({ keyword: "", reply: "" }, count);
    customRulesList.append(row);
    updateCustomRuleUi();
    row.querySelector(".custom-rule-keyword").focus();
  }

  function renderProfile(profile) {
    for (const field of profileFields) {
      const control = profileForm.elements.namedItem(field);
      if (control) control.value = profile[field] || "";
    }
    renderCustomRules(profile.customRules);
    const completed = personalProfileFields.filter((field) => profile[field]).length;
    profileCount.textContent = `${completed}/6`;
    profileProgress.textContent = completed > 0 ? `已設定 ${completed}／6` : "尚未設定";
    profileOpenButton.setAttribute("aria-label", completed > 0 ? `我的基本資料已設定 ${completed} 項` : "開啟我的基本資料");
  }

  function setProfileStatus(message, state) {
    profileStatus.textContent = message;
    profileStatus.classList.toggle("is-success", state === "success");
    profileStatus.classList.toggle("is-error", state === "error");
  }

  async function profileStore(method, profile) {
    const nativeStore = plugin("Profile");
    if (isNative()) {
      if (!nativeStore || typeof nativeStore[method] !== "function") throw new Error("Profile plugin unavailable");
      return nativeStore[method](profile || {});
    }

    if (method === "getProfile") {
      try {
        return JSON.parse(localStorage.getItem(webProfileKey) || "{}");
      } catch {
        return {};
      }
    }
    if (method === "saveProfile") localStorage.setItem(webProfileKey, JSON.stringify(profile || {}));
    if (method === "clearProfile") localStorage.removeItem(webProfileKey);
    return method === "saveProfile" ? profile : {};
  }

  async function loadProfile() {
    try {
      const profile = normalizedProfile(await profileStore("getProfile"));
      renderProfile(profile);
      return profile;
    } catch {
      setProfileStatus("無法讀取基本資料，請重新開啟 App。", "error");
      return normalizedProfile({});
    }
  }

  function openProfile() {
    profilePage.classList.add("is-open");
    profilePage.setAttribute("aria-hidden", "false");
    homePage.setAttribute("aria-hidden", "true");
    homePage.inert = true;
    document.body.classList.add("profile-open");
    profilePage.scrollTop = 0;
    void loadProfile();
  }

  function closeProfile() {
    profilePage.classList.remove("is-open");
    profilePage.setAttribute("aria-hidden", "true");
    homePage.removeAttribute("aria-hidden");
    homePage.inert = false;
    document.body.classList.remove("profile-open");
    profileOpenButton.focus();
  }

  function bindHorizontalSwipe(element, direction, callback) {
    let start = null;
    element.addEventListener("pointerdown", (event) => {
      if (event.target.closest("input, textarea, button, a")) return;
      start = { x: event.clientX, y: event.clientY, time: Date.now() };
    });
    element.addEventListener("pointerup", (event) => {
      if (!start) return;
      const deltaX = event.clientX - start.x;
      const deltaY = event.clientY - start.y;
      const elapsed = Date.now() - start.time;
      start = null;
      const intended = direction === "right" ? deltaX > 72 : deltaX < -72;
      if (intended && Math.abs(deltaX) > Math.abs(deltaY) * 1.25 && elapsed < 850) callback();
    });
    element.addEventListener("pointercancel", () => { start = null; });
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!profileForm.reportValidity()) return;
    let profile;
    try {
      profile = profileFromForm();
    } catch (error) {
      setProfileStatus(error.message, "error");
      return;
    }
    profileForm.classList.add("is-saving");
    setProfileStatus("正在儲存到這台裝置…", "ready");
    try {
      const saved = normalizedProfile(await profileStore("saveProfile", profile));
      renderProfile(saved);
      const completed = personalProfileFields.filter((field) => saved[field]).length;
      const rules = normalizeCustomRules(saved.customRules).length;
      setProfileStatus(
        completed > 0 || rules > 0
          ? `已儲存 ${completed} 項基本資料與 ${rules} 組自訂回覆；只會套用明確相符的題目。`
          : "目前沒有填寫任何資料或自訂回覆。",
        "success"
      );
    } catch {
      setProfileStatus("儲存失敗，請重新開啟 App 後再試一次。", "error");
    } finally {
      profileForm.classList.remove("is-saving");
    }
  }

  async function clearProfile() {
    if (!window.confirm("確定要清除這台裝置上的全部基本資料與自訂回覆嗎？")) return;
    profileForm.classList.add("is-saving");
    try {
      const cleared = normalizedProfile(await profileStore("clearProfile"));
      renderProfile(cleared);
      setProfileStatus("基本資料與自訂回覆已全部清除。", "success");
    } catch {
      setProfileStatus("清除失敗，請稍後再試一次。", "error");
    } finally {
      profileForm.classList.remove("is-saving");
    }
  }

  async function openAutofilledSurvey(rawValue, sourceLabel) {
    const url = safeSurveyUrl(rawValue);
    if (!url) {
      setState(`${sourceLabel}：不是安全的 HTTPS 表單網址`, "error");
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
      await openAutofilledSurvey(result.ScanResult, "相機掃到的 QR Code");
    } catch (error) {
      const message = error && error.message ? error.message : String(error || "");
      if (/cancel/i.test(message)) setState("已取消，準備好可再次掃描", "ready");
      else setState("無法啟動掃描器，請確認相機權限後再試一次", "error");
    } finally {
      finishBusyState();
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
      await openAutofilledSurvey(result.ScanResult, "圖片中的 QR Code");
    } catch (error) {
      const code = String(error && error.code || "");
      const message = String(error && error.message || error || "");
      if (code === "NO_QR_CODE" || /找不到 QR Code/i.test(message)) {
        setState("這張圖片裡找不到 QR Code，請換一張清楚的圖片", "error");
      } else {
        setState("無法辨識圖片，請換一張 QR Code 圖片再試一次", "error");
      }
    } finally {
      finishBusyState();
    }
  }

  async function openPastedUrl(event) {
    event.preventDefault();
    if (busy) return;

    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
      setState("請先貼上 HTTPS 表單連結", "error");
      urlInput.focus();
      return;
    }

    if (!safeSurveyUrl(rawUrl)) {
      setState("貼上的連結必須是完整的 HTTPS 網址", "error");
      urlInput.focus();
      return;
    }

    urlInput.blur();
    busy = true;
    try {
      await openAutofilledSurvey(rawUrl, "貼上的連結");
    } catch {
      setState("無法開啟這個連結，請確認網址後再試一次", "error");
    } finally {
      finishBusyState();
    }
  }

  button.addEventListener("click", startScan);
  galleryButton.addEventListener("click", scanGalleryImage);
  urlForm.addEventListener("submit", openPastedUrl);
  urlInput.addEventListener("focus", () => document.body.classList.add("url-editing"));
  urlInput.addEventListener("blur", () => document.body.classList.remove("url-editing"));
  profileOpenButton.addEventListener("click", openProfile);
  profileBackButton.addEventListener("click", closeProfile);
  profileForm.addEventListener("submit", saveProfile);
  profileClearButton.addEventListener("click", clearProfile);
  addCustomRuleButton.addEventListener("click", addCustomRule);
  customRulesList.addEventListener("input", updateCustomRuleUi);
  customRulesList.addEventListener("click", (event) => {
    const remove = event.target.closest(".custom-rule-remove");
    if (!remove) return;
    remove.closest(".custom-rule-row").remove();
    const rows = Array.from(customRulesList.querySelectorAll(".custom-rule-row"));
    if (!rows.length) customRulesList.append(createCustomRuleRow({ keyword: "", reply: "" }, 0));
    Array.from(customRulesList.querySelectorAll(".custom-rule-row")).forEach((row, index) => {
      row.querySelector(".custom-rule-row-head span").textContent = String(index + 1).padStart(2, "0");
      row.querySelector(".custom-rule-remove").setAttribute("aria-label", `刪除第 ${index + 1} 組規則`);
    });
    updateCustomRuleUi();
  });
  bindHorizontalSwipe(homePage, "right", openProfile);
  bindHorizontalSwipe(profilePage, "left", closeProfile);
  void loadProfile();
})();
