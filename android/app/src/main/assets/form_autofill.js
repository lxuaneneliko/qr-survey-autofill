(async function () {
  if (window.__qrSurveyAutofillRunning) return;
  window.__qrSurveyAutofillRunning = true;

  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const defaultTextAnswer = "無";
  const legacyDefaultAnswer = "這是由掃表自動產生並填入的回覆。";
  const matcher = window.QRSurveyProfileMatching || null;
  const customMatcher = window.QRSurveyCustomRuleMatching || null;
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
  const profileFields = ["name", "email", "university", "department", "grade", "studentId", "defaultAnswer", "customRules"];
  const profile = {};
  for (const field of profileFields) {
    const value = window.__qrSurveyProfile && window.__qrSurveyProfile[field];
    profile[field] = field === "customRules" ? String(value || "").trim() : normalize(value);
  }
  if (!profile.defaultAnswer || profile.defaultAnswer === legacyDefaultAnswer) profile.defaultAnswer = defaultTextAnswer;
  const customRules = customMatcher ? customMatcher.parse(profile.customRules) : [];
  const textControlSelector = 'textarea, input:not([type]), input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="number"], input[type="date"], input[type="time"], input[type="datetime-local"], input[type="month"], input[type="week"], [contenteditable="true"]';

  function contextText(element, root) {
    const labelledBy = element.getAttribute("aria-labelledby");
    const labelledText = labelledBy
      ? labelledBy.split(/\s+/).map((id) => normalize(document.getElementById(id)?.textContent)).join(" ")
      : "";
    const explicitLabel = element.id
      ? normalize(document.querySelector(`label[for="${escapeSelector(element.id)}"]`)?.textContent)
      : "";
    const wrappingLabel = normalize(element.closest("label")?.textContent);
    const heading = normalize((root.querySelector('[role="heading"], legend, h1, h2, h3, h4, .question-title')
      || root.closest('[role="listitem"], [data-automation-id="questionItem"], [data-question-id]')?.querySelector('[role="heading"], legend, h1, h2, h3, h4, .question-title'))?.textContent);
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

  function customRuleMatch(element, root) {
    return customMatcher ? customMatcher.match(customRules, contextText(element, root)) : null;
  }

  function answerMatch(element, root, type) {
    return profileMatch(element, root, type) || customRuleMatch(element, root);
  }

  function generatedAnswer(element, root) {
    const context = contextText(element, root);
    const type = String(element.getAttribute("type") || "text").toLowerCase();
    const matchedAnswer = answerMatch(element, root, type);
    if (matchedAnswer) return { value: matchedAnswer.value, match: matchedAnswer };
    if (type === "date") return { value: `${yyyy}-${mm}-${dd}`, match: null };
    if (type === "time") return { value: "10:00", match: null };
    if (type === "datetime-local") return { value: `${yyyy}-${mm}-${dd}T10:00`, match: null };
    if (type === "month") return { value: `${yyyy}-${mm}`, match: null };
    if (type === "week") return { value: `${yyyy}-W01`, match: null };
    if (context.includes("年") && (context.includes("日期") || context.includes("生日"))) return { value: yyyy, match: null };
    if (context.includes("月") && (context.includes("日期") || context.includes("生日"))) return { value: String(now.getMonth() + 1), match: null };
    if (context.includes("日") && (context.includes("日期") || context.includes("生日"))) return { value: String(now.getDate()), match: null };

    if (type === "email" || /email|e-mail|電子郵件|信箱|郵件/.test(context)) return { value: "demo@example.com", match: null };
    if (type === "tel" || /電話|手機|聯絡號碼|phone|mobile/.test(context)) return { value: "0912345678", match: null };
    if (type === "url" || /網址|網站|url|website/.test(context)) return { value: "https://example.com", match: null };
    if (type === "number" || /年齡|歲數|數量|人數|age|number/.test(context)) return { value: "20", match: null };
    return { value: profile.defaultAnswer, match: null };
  }

  function setValue(element, value) {
    if (!visible(element)) return false;
    if (element.isContentEditable) {
      if (normalize(element.textContent)) return false;
      element.focus();
      element.textContent = value;
      const inputEvent = typeof InputEvent === "function"
        ? new InputEvent("input", { bubbles: true, composed: true, data: value, inputType: "insertText" })
        : new Event("input", { bubbles: true, composed: true });
      element.dispatchEvent(inputEvent);
      element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      element.blur();
      return true;
    }
    if (normalize(element.value)) return false;
    const prototype = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor && descriptor.set) descriptor.set.call(element, value);
    else element.value = value;
    if (!normalize(element.value) || (element.validity && !element.validity.valid)) {
      if (descriptor && descriptor.set) descriptor.set.call(element, "");
      else element.value = "";
      return false;
    }
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
    if (matcher) return matcher.matchesOption(choiceText(element), preferredValue);
    return normalize(choiceText(element)).toLowerCase() === normalize(preferredValue).toLowerCase();
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
    const controlSelector = 'input, textarea, select, [role="radio"], [role="checkbox"], [role="listbox"], [contenteditable="true"]';
    const candidates = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector))).filter((root) => {
      if (!visible(root) || !root.querySelector(controlSelector)) return false;
      if (root.matches('div[role="listitem"]') && !root.querySelector('[role="heading"]')) return false;
      return true;
    });
    const roots = [...new Set(candidates.filter((candidate) => !candidates.some((other) => other !== candidate && candidate.contains(other))))];

    const controls = Array.from(document.querySelectorAll(controlSelector)).filter((element) => {
      const type = String(element.getAttribute("type") || "").toLowerCase();
      return (element.closest("form") || candidates.some((candidate) => candidate.contains(element)))
        && (visible(element) || (type === "file" && visible(element.parentElement)))
        && !["hidden", "submit", "reset", "button", "image"].includes(type);
    });
    for (const control of controls) {
      if (roots.some((root) => root.contains(control))) continue;
      const root = control.closest("fieldset, [role='group'], label") || control.parentElement;
      if (root && !roots.some((existing) => existing === root || existing.contains(root))) roots.push(root);
    }
    return roots;
  }

  function rootAnswered(root) {
    const textInputs = Array.from(root.querySelectorAll(textControlSelector));
    if (textInputs.some((element) => visible(element) && normalize(element.isContentEditable ? element.textContent : element.value))) return true;
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
    const fileInputs = Array.from(root.querySelectorAll('input[type="file"]'));
    const applied = new Set();

    const textInputs = Array.from(root.querySelectorAll(textControlSelector)).filter(visible);
    for (const input of textInputs) {
      const answer = generatedAnswer(input, root);
      if (setValue(input, answer.value) && answer.match) applied.add(answer.match.label);
    }

    const selects = Array.from(root.querySelectorAll("select")).filter(visible);
    for (const select of selects) {
      if (select.selectedIndex > 0 || select.options.length <= 1) continue;
      const matchedProfile = answerMatch(select, root, "select");
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
        const matchedProfile = answerMatch(group, root, "radio");
        const result = chooseOne(Array.from(group.querySelectorAll('[role="radio"]')), matchedProfile);
        if (result.applied) applied.add(result.applied.label);
      }
    } else {
      const roleRadios = Array.from(root.querySelectorAll('[role="radio"]'));
      const matchedProfile = roleRadios.length ? answerMatch(roleRadios[0], root, "radio") : null;
      const result = chooseOne(roleRadios, matchedProfile);
      if (result.applied) applied.add(result.applied.label);
    }

    const nativeRadios = Array.from(root.querySelectorAll('input[type="radio"]')).filter(visible);
    const radioNames = new Set(nativeRadios.map((radio) => radio.name || "__unnamed"));
    for (const name of radioNames) {
      const radioGroup = nativeRadios.filter((radio) => (radio.name || "__unnamed") === name);
      const matchedProfile = answerMatch(radioGroup[0], root, "radio");
      const result = chooseOne(radioGroup, matchedProfile);
      if (result.applied) applied.add(result.applied.label);
    }

    const roleCheckboxes = Array.from(root.querySelectorAll('[role="checkbox"]')).filter(visible);
    if (roleCheckboxes.length && !roleCheckboxes.some(isSelected)) {
      const matchedAnswer = answerMatch(roleCheckboxes[0], root, "checkbox");
      const result = chooseOne(roleCheckboxes, matchedAnswer);
      if (result.applied) applied.add(result.applied.label);
    }
    const nativeCheckboxes = Array.from(root.querySelectorAll('input[type="checkbox"]')).filter(visible);
    if (nativeCheckboxes.length && !nativeCheckboxes.some(isSelected)) {
      const matchedAnswer = answerMatch(nativeCheckboxes[0], root, "checkbox");
      const result = chooseOne(nativeCheckboxes, matchedAnswer);
      if (result.applied) applied.add(result.applied.label);
    }

    const listboxes = Array.from(root.querySelectorAll('[role="listbox"]')).filter(visible);
    for (const listbox of listboxes) {
      const matchedProfile = answerMatch(listbox, root, "listbox");
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
