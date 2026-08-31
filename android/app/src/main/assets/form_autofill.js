(async function () {
  if (window.__qrSurveyAutofillRunning) return;
  window.__qrSurveyAutofillRunning = true;

  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const matcher = window.QRSurveyProfileMatching || null;
  const visible = (element) => {
    if (!element || element.disabled || element.getAttribute("aria-disabled") === "true") return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  };
  const escapeSelector = (value) => {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  };

  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const profileFields = ["name", "email", "university", "department", "grade"];
  const profile = {};
  for (const field of profileFields) profile[field] = normalize(window.__qrSurveyProfile && window.__qrSurveyProfile[field]);

  function contextText(element, root) {
    const labelledBy = element.getAttribute("aria-labelledby");
    const labelledText = labelledBy
      ? labelledBy.split(/\s+/).map((id) => normalize(document.getElementById(id)?.textContent)).join(" ")
      : "";
    const explicitLabel = element.id
      ? normalize(document.querySelector(`label[for="${escapeSelector(element.id)}"]`)?.textContent)
      : "";
    const wrappingLabel = normalize(element.closest("label")?.textContent);
    const heading = normalize(root.querySelector('[role="heading"], legend, h1, h2, h3, h4, .question-title')?.textContent);
    return normalize([
      labelledText,
      explicitLabel,
      wrappingLabel,
      element.getAttribute("aria-label"),
      element.getAttribute("placeholder"),
      element.getAttribute("name"),
      heading,
      root.textContent,
    ].filter(Boolean).join(" ")).toLowerCase();
  }

  function profileMatch(element, root, type) {
    return matcher ? matcher.match(profile, contextText(element, root), type) : null;
  }

  function generatedAnswer(element, root) {
    const context = contextText(element, root);
    const type = String(element.getAttribute("type") || "text").toLowerCase();
    if (type === "date") return { value: `${yyyy}-${mm}-${dd}`, match: null };
    if (type === "time") return { value: "10:00", match: null };
    if (type === "datetime-local") return { value: `${yyyy}-${mm}-${dd}T10:00`, match: null };
    if (type === "month") return { value: `${yyyy}-${mm}`, match: null };
    if (type === "week") return { value: `${yyyy}-W01`, match: null };
    if (context.includes("年") && (context.includes("日期") || context.includes("生日"))) return { value: yyyy, match: null };
    if (context.includes("月") && (context.includes("日期") || context.includes("生日"))) return { value: String(now.getMonth() + 1), match: null };
    if (context.includes("日") && (context.includes("日期") || context.includes("生日"))) return { value: String(now.getDate()), match: null };

    const matchedProfile = profileMatch(element, root, type);
    if (matchedProfile) return { value: matchedProfile.value, match: matchedProfile };
    if (type === "email" || /email|e-mail|電子郵件|信箱|郵件/.test(context)) return { value: "demo@example.com", match: null };
    if (type === "tel" || /電話|手機|聯絡號碼|phone|mobile/.test(context)) return { value: "0912345678", match: null };
    if (type === "url" || /網址|網站|url|website/.test(context)) return { value: "https://example.com", match: null };
    if (type === "number" || /年齡|歲數|數量|人數|age|number/.test(context)) return { value: "20", match: null };
    if (/姓名|名字|稱呼|name/.test(context)) return { value: "測試使用者", match: null };
    if (/學校|單位|公司|organization|company|school/.test(context)) return { value: "測試單位", match: null };
    if (/意見|建議|原因|心得|說明|描述|回饋|留言|comment|feedback|description|why/.test(context) || element.tagName === "TEXTAREA") {
      return { value: "這是由掃表自動產生並填入的回覆。", match: null };
    }
    return { value: "自動填寫", match: null };
  }

  function setValue(element, value) {
    if (!visible(element) || normalize(element.value)) return false;
    const prototype = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor && descriptor.set) descriptor.set.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
    return true;
  }

  function safeClick(element) {
    if (!visible(element)) return false;
    element.scrollIntoView({ block: "center", inline: "nearest" });
    element.click();
    return true;
  }

  function isSelected(element) {
    return element.checked === true || element.getAttribute("aria-checked") === "true" || element.getAttribute("aria-selected") === "true";
  }

  function choiceText(element) {
    const explicitLabel = element.id
      ? normalize(document.querySelector(`label[for="${escapeSelector(element.id)}"]`)?.textContent)
      : "";
    return normalize([
      element.getAttribute("aria-label"),
      element.getAttribute("data-value"),
      element.getAttribute("value"),
      explicitLabel,
      element.closest("label")?.textContent,
      element.textContent,
    ].filter(Boolean).join(" "));
  }

  function matchesPreferred(element, preferredValue) {
    return Boolean(matcher && matcher.matchesOption(choiceText(element), preferredValue));
  }

  function chooseOne(elements, matchedProfile) {
    const choices = elements.filter(visible);
    if (!choices.length || choices.some(isSelected)) return { clicked: false, applied: null };
    const preferredChoice = matchedProfile
      ? choices.find((choice) => matchesPreferred(choice, matchedProfile.value))
      : null;
    if (matchedProfile && !preferredChoice) return { clicked: false, applied: null };
    const numeric = choices.every((choice) => /^\s*\d+(?:\.\d+)?\s*$/.test(normalize(choiceText(choice))));
    const fallback = choices[numeric ? Math.floor(choices.length / 2) : 0];
    const clicked = safeClick(preferredChoice || fallback);
    return { clicked, applied: clicked && preferredChoice ? matchedProfile : null };
  }

  async function fillListbox(listbox, matchedProfile) {
    const selectedOption = listbox.querySelector('[role="option"][aria-selected="true"]');
    const current = normalize(selectedOption?.textContent || selectedOption?.getAttribute("aria-label"));
    if (current && !/^(選擇|請選擇|choose|select|dropdown|下拉式選單)$/i.test(current)) return { clicked: false, applied: null };
    if (!safeClick(listbox)) return { clicked: false, applied: null };
    await wait(140);

    const controlsId = listbox.getAttribute("aria-controls");
    const optionRoot = controlsId ? document.getElementById(controlsId) : document;
    const options = Array.from(optionRoot.querySelectorAll('[role="option"]')).filter((option) => {
      const text = normalize(choiceText(option));
      return visible(option) && text && !/^(選擇|請選擇|choose|select)$/i.test(text);
    });
    const preferredOption = matchedProfile
      ? options.find((option) => matchesPreferred(option, matchedProfile.value))
      : null;
    if (matchedProfile && !preferredOption) {
      listbox.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return { clicked: false, applied: null };
    }
    const option = preferredOption || options.find((item) => !isSelected(item));
    const clicked = option ? safeClick(option) : false;
    return { clicked, applied: clicked && preferredOption ? matchedProfile : null };
  }

  function questionRoots() {
    const selectors = [
      'div[role="listitem"]',
      '[data-automation-id="questionItem"]',
      '[data-question-id]',
      '[data-testid*="question"]',
      ".question-row",
      ".survey-question",
      "fieldset",
    ];
    const controlSelector = 'input, textarea, select, [role="radio"], [role="checkbox"], [role="listbox"]';

    for (const selector of selectors) {
      const candidates = Array.from(document.querySelectorAll(selector)).filter((root) => {
        if (!visible(root) || !root.querySelector(controlSelector)) return false;
        if (selector === 'div[role="listitem"]' && !root.querySelector('[role="heading"]')) return false;
        return true;
      });
      const leafCandidates = candidates.filter((candidate) => {
        return !candidates.some((other) => other !== candidate && candidate.contains(other));
      });
      if (leafCandidates.length) return leafCandidates;
    }

    const controls = Array.from(document.querySelectorAll("form input, form textarea, form select")).filter((element) => {
      const type = String(element.getAttribute("type") || "").toLowerCase();
      return visible(element) && !["hidden", "submit", "reset", "button", "image"].includes(type);
    });
    const roots = [];
    for (const control of controls) {
      const root = control.closest("fieldset, label, [role='group'], div") || control.parentElement;
      if (root && !roots.includes(root)) roots.push(root);
    }
    return roots;
  }

  function rootAnswered(root) {
    const textInputs = Array.from(root.querySelectorAll('textarea, input:not([type]), input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="number"], input[type="date"], input[type="time"], input[type="datetime-local"], input[type="month"], input[type="week"]'));
    if (textInputs.some((element) => visible(element) && normalize(element.value))) return true;
    const choices = Array.from(root.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]'));
    if (choices.some(isSelected)) return true;
    const selects = Array.from(root.querySelectorAll("select"));
    if (selects.some((element) => element.selectedIndex > 0 && normalize(element.value))) return true;
    const listboxes = Array.from(root.querySelectorAll('[role="listbox"]'));
    return listboxes.some((element) => {
      const selectedOption = element.querySelector('[role="option"][aria-selected="true"]');
      const text = normalize(selectedOption?.textContent || selectedOption?.getAttribute("aria-label"));
      return text && !/^(選擇|請選擇|choose|select|dropdown|下拉式選單)$/i.test(text);
    });
  }

  async function fillRoot(root) {
    const fileInputs = Array.from(root.querySelectorAll('input[type="file"]')).filter(visible);
    const applied = new Set();

    const textInputs = Array.from(root.querySelectorAll(
      'textarea, input:not([type]), input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="number"], input[type="date"], input[type="time"], input[type="datetime-local"], input[type="month"], input[type="week"]'
    )).filter(visible);
    for (const input of textInputs) {
      const answer = generatedAnswer(input, root);
      if (setValue(input, answer.value) && answer.match) applied.add(answer.match.label);
    }

    const selects = Array.from(root.querySelectorAll("select")).filter(visible);
    for (const select of selects) {
      if (select.selectedIndex > 0 || select.options.length <= 1) continue;
      const matchedProfile = profileMatch(select, root, "select");
      const options = Array.from(select.options).filter((option) => !option.disabled && normalize(choiceText(option)));
      const preferredOption = matchedProfile
        ? options.find((option) => matchesPreferred(option, matchedProfile.value))
        : null;
      if (matchedProfile && !preferredOption) continue;
      const targetOption = preferredOption || options.find((option) => option.index > 0);
      if (!targetOption) continue;
      select.selectedIndex = targetOption.index;
      select.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      select.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      if (preferredOption) applied.add(matchedProfile.label);
    }

    const roleRadioGroups = Array.from(root.querySelectorAll('[role="radiogroup"]')).filter(visible);
    if (roleRadioGroups.length) {
      for (const group of roleRadioGroups) {
        const matchedProfile = profileMatch(group, root, "radio");
        const result = chooseOne(Array.from(group.querySelectorAll('[role="radio"]')), matchedProfile);
        if (result.applied) applied.add(result.applied.label);
      }
    } else {
      const roleRadios = Array.from(root.querySelectorAll('[role="radio"]'));
      const matchedProfile = roleRadios.length ? profileMatch(roleRadios[0], root, "radio") : null;
      const result = chooseOne(roleRadios, matchedProfile);
      if (result.applied) applied.add(result.applied.label);
    }

    const nativeRadios = Array.from(root.querySelectorAll('input[type="radio"]')).filter(visible);
    const radioNames = new Set(nativeRadios.map((radio) => radio.name || "__unnamed"));
    for (const name of radioNames) {
      const radioGroup = nativeRadios.filter((radio) => (radio.name || "__unnamed") === name);
      const matchedProfile = profileMatch(radioGroup[0], root, "radio");
      const result = chooseOne(radioGroup, matchedProfile);
      if (result.applied) applied.add(result.applied.label);
    }

    const roleCheckboxes = Array.from(root.querySelectorAll('[role="checkbox"]')).filter(visible);
    if (roleCheckboxes.length && !roleCheckboxes.some(isSelected)) safeClick(roleCheckboxes[0]);
    const nativeCheckboxes = Array.from(root.querySelectorAll('input[type="checkbox"]')).filter(visible);
    if (nativeCheckboxes.length && !nativeCheckboxes.some(isSelected)) safeClick(nativeCheckboxes[0]);

    const listboxes = Array.from(root.querySelectorAll('[role="listbox"]')).filter(visible);
    for (const listbox of listboxes) {
      const matchedProfile = profileMatch(listbox, root, "listbox");
      const result = await fillListbox(listbox, matchedProfile);
      if (result.applied) applied.add(result.applied.label);
    }

    return { answered: rootAnswered(root), unsupported: fileInputs.length > 0, matches: Array.from(applied) };
  }

  try {
    const roots = questionRoots();
    let filled = 0;
    let unsupported = 0;
    const matches = new Set();
    for (const root of roots) {
      const result = await fillRoot(root);
      if (result.answered) filled += 1;
      if (result.unsupported && !result.answered) unsupported += 1;
      for (const label of result.matches) matches.add(label);
      await wait(40);
    }

    if (window.QRSurveyNative && typeof window.QRSurveyNative.report === "function") {
      window.QRSurveyNative.report(JSON.stringify({ filled, total: roots.length, unsupported, matches: Array.from(matches) }));
    }
  } catch (error) {
    if (window.QRSurveyNative && typeof window.QRSurveyNative.report === "function") {
      window.QRSurveyNative.report(JSON.stringify({ filled: 0, total: 0, unsupported: 0, matches: [], error: String(error) }));
    }
  } finally {
    window.__qrSurveyAutofillRunning = false;
  }
})();
