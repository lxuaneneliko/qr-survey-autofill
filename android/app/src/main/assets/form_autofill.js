(async function () {
  if (window.__qrSurveyAutofillRunning) return;
  window.__qrSurveyAutofillRunning = true;

  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
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
  const profileFields = ["name", "university", "department", "grade", "studentId", "email", "phone"];
  const profile = {};
  for (const field of profileFields) {
    profile[field] = normalize(window.__qrSurveyProfile && window.__qrSurveyProfile[field]);
  }

  function profileMatch(context, type) {
    const text = normalize(context).toLowerCase();
    if (/學號|學籍號|student\s*(id|number)|studentid/.test(text) && profile.studentId) return { key: "studentId", value: profile.studentId };
    if ((type === "email" || /email|e-mail|電子郵件|信箱|郵件/.test(text)) && profile.email) return { key: "email", value: profile.email };
    if ((type === "tel" || /電話|手機|聯絡號碼|phone|mobile/.test(text)) && profile.phone) return { key: "phone", value: profile.phone };
    if (/系級|department\s*(and|&)\s*(grade|year)/.test(text) && (profile.department || profile.grade)) {
      return { key: "departmentGrade", value: normalize(`${profile.department} ${profile.grade}`) };
    }
    if (/系所|科系|學系|主修|department|major/.test(text) && profile.department) return { key: "department", value: profile.department };
    if (/年級|就讀年|grade|year\s*(of\s*)?(study|school)/.test(text) && profile.grade) return { key: "grade", value: profile.grade };
    if (/大學|學校|院校|就讀學校|university|college|school/.test(text) && profile.university) return { key: "university", value: profile.university };
    const asksForName = /姓名|名字|全名|稱呼|full\s*name|your\s*name|\bname\b/.test(text);
    const asksForOrganizationName = /公司|單位|組織|品牌|company|organization|business|brand/.test(text);
    if (asksForName && !asksForOrganizationName && profile.name) return { key: "name", value: profile.name };
    return null;
  }

  function gradeNumber(value) {
    const text = normalize(value);
    if (/大一|一年級|1\s*年級/.test(text)) return "1";
    if (/大二|二年級|2\s*年級/.test(text)) return "2";
    if (/大三|三年級|3\s*年級/.test(text)) return "3";
    if (/大四|四年級|4\s*年級/.test(text)) return "4";
    if (/大五|五年級|5\s*年級/.test(text)) return "5";
    return value;
  }

  function comparableValue(value) {
    const text = normalize(value).toLowerCase().replace(/臺/g, "台");
    const compact = text.replace(/[\s()（）【】\[\]、,，.。/／_-]/g, "");
    if (/大一|一年級|1年級|freshman|firstyear/.test(compact)) return "__grade1";
    if (/大二|二年級|2年級|sophomore|secondyear/.test(compact)) return "__grade2";
    if (/大三|三年級|3年級|junior|thirdyear/.test(compact)) return "__grade3";
    if (/大四|四年級|4年級|senior|fourthyear/.test(compact)) return "__grade4";
    if (/大五|五年級|5年級|fifthyear/.test(compact)) return "__grade5";
    if (/研究所|碩士|博士|graduate|master|phd/.test(compact)) return "__graduate";
    return compact;
  }

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

  function generatedAnswer(element, root) {
    const context = contextText(element, root);
    const type = String(element.getAttribute("type") || "text").toLowerCase();
    if (type === "date") return { value: `${yyyy}-${mm}-${dd}`, personalized: false };
    if (type === "time") return { value: "10:00", personalized: false };
    if (type === "datetime-local") return { value: `${yyyy}-${mm}-${dd}T10:00`, personalized: false };
    if (type === "month") return { value: `${yyyy}-${mm}`, personalized: false };
    if (type === "week") return { value: `${yyyy}-W01`, personalized: false };
    if (context.includes("年") && (context.includes("日期") || context.includes("生日"))) return { value: yyyy, personalized: false };
    if (context.includes("月") && (context.includes("日期") || context.includes("生日"))) return { value: String(now.getMonth() + 1), personalized: false };
    if (context.includes("日") && (context.includes("日期") || context.includes("生日"))) return { value: String(now.getDate()), personalized: false };
    const matchedProfile = profileMatch(context, type);
    if (matchedProfile) {
      const value = type === "number" && matchedProfile.key === "grade" ? gradeNumber(matchedProfile.value) : matchedProfile.value;
      return { value, personalized: true };
    }
    if (type === "email" || /email|e-mail|電子郵件|信箱|郵件/.test(context)) return { value: "demo@example.com", personalized: false };
    if (type === "tel" || /電話|手機|聯絡號碼|phone|mobile/.test(context)) return { value: "0912345678", personalized: false };
    if (type === "url" || /網址|網站|url|website/.test(context)) return { value: "https://example.com", personalized: false };
    if (type === "number" || /年齡|歲數|數量|人數|age|number/.test(context)) return { value: "20", personalized: false };
    if (/姓名|名字|稱呼|name/.test(context)) return { value: "測試使用者", personalized: false };
    if (/學校|單位|公司|organization|company|school/.test(context)) return { value: "測試單位", personalized: false };
    if (/意見|建議|原因|心得|說明|描述|回饋|留言|comment|feedback|description|why/.test(context) || element.tagName === "TEXTAREA") {
      return { value: "這是由掃表自動產生並填入的回覆。", personalized: false };
    }
    return { value: "自動填寫", personalized: false };
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
    if (!preferredValue) return false;
    const candidate = comparableValue(choiceText(element));
    const preferred = comparableValue(preferredValue);
    if (!candidate || !preferred) return false;
    return candidate === preferred
      || (preferred.length >= 3 && candidate.includes(preferred))
      || (candidate.length >= 3 && preferred.includes(candidate));
  }

  function chooseOne(elements, preferredValue) {
    const choices = elements.filter(visible);
    if (!choices.length || choices.some(isSelected)) return { clicked: false, personalized: false };
    const preferredChoice = choices.find((choice) => matchesPreferred(choice, preferredValue));
    const numeric = choices.every((choice) => /^\s*\d+(?:\.\d+)?\s*$/.test(normalize(choice.getAttribute("aria-label") || choice.textContent)));
    const index = numeric ? Math.floor(choices.length / 2) : 0;
    const clicked = safeClick(preferredChoice || choices[index]);
    return { clicked, personalized: clicked && Boolean(preferredChoice) };
  }

  async function fillListbox(listbox, preferredValue) {
    const selectedOption = listbox.querySelector('[role="option"][aria-selected="true"]');
    const current = normalize(selectedOption?.textContent || selectedOption?.getAttribute("aria-label"));
    if (current && !/^(選擇|請選擇|choose|select|dropdown|下拉式選單)$/i.test(current)) return { clicked: false, personalized: false };
    if (!safeClick(listbox)) return { clicked: false, personalized: false };
    await wait(120);

    const controlsId = listbox.getAttribute("aria-controls");
    const optionRoot = controlsId ? document.getElementById(controlsId) : document;
    const options = Array.from(optionRoot.querySelectorAll('[role="option"]')).filter((option) => {
      const text = normalize(option.textContent || option.getAttribute("aria-label"));
      return visible(option) && text && !/^(選擇|請選擇|choose|select)$/i.test(text);
    });
    const preferredOption = options.find((option) => matchesPreferred(option, preferredValue));
    const option = preferredOption || options.find((item) => !isSelected(item));
    const clicked = option ? safeClick(option) : false;
    return { clicked, personalized: clicked && Boolean(preferredOption) };
  }

  function questionRoots() {
    const selectors = [
      'div[role="listitem"]',
      '[data-automation-id="questionItem"]',
      '[data-question-id]',
      '[data-testid*="question"]',
      '.question-row',
      '.survey-question',
      'fieldset',
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

    const controls = Array.from(document.querySelectorAll('form input, form textarea, form select')).filter((element) => {
      const type = String(element.getAttribute("type") || "").toLowerCase();
      return visible(element) && !["hidden", "submit", "reset", "button", "image"].includes(type);
    });
    const roots = [];
    for (const control of controls) {
      let root = control.closest("fieldset, label, [role='group'], div") || control.parentElement;
      if (!root) continue;
      if (!roots.some((item) => item === root)) roots.push(root);
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
    let personalized = false;

    const textInputs = Array.from(root.querySelectorAll(
      'textarea, input:not([type]), input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="number"], input[type="date"], input[type="time"], input[type="datetime-local"], input[type="month"], input[type="week"]'
    )).filter(visible);
    for (const input of textInputs) {
      const answer = generatedAnswer(input, root);
      if (setValue(input, answer.value) && answer.personalized) personalized = true;
    }

    const selects = Array.from(root.querySelectorAll("select")).filter(visible);
    for (const select of selects) {
      if (select.selectedIndex <= 0 && select.options.length > 1) {
        const matchedProfile = profileMatch(contextText(select, root), "select");
        const options = Array.from(select.options).filter((option) => !option.disabled && normalize(choiceText(option)));
        const preferredOption = matchedProfile
          ? options.find((option) => matchesPreferred(option, matchedProfile.value))
          : null;
        const targetOption = preferredOption || options.find((option) => option.index > 0);
        if (!targetOption) continue;
        select.selectedIndex = targetOption.index;
        select.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        select.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        if (preferredOption) personalized = true;
      }
    }

    const roleRadioGroups = Array.from(root.querySelectorAll('[role="radiogroup"]')).filter(visible);
    if (roleRadioGroups.length) {
      for (const group of roleRadioGroups) {
        const matchedProfile = profileMatch(contextText(group, root), "radio");
        const result = chooseOne(Array.from(group.querySelectorAll('[role="radio"]')), matchedProfile?.value);
        if (result.personalized) personalized = true;
      }
    } else {
      const roleRadios = Array.from(root.querySelectorAll('[role="radio"]'));
      const matchedProfile = roleRadios.length ? profileMatch(contextText(roleRadios[0], root), "radio") : null;
      const result = chooseOne(roleRadios, matchedProfile?.value);
      if (result.personalized) personalized = true;
    }

    const nativeRadios = Array.from(root.querySelectorAll('input[type="radio"]')).filter(visible);
    const radioNames = new Set(nativeRadios.map((radio) => radio.name || "__unnamed"));
    for (const name of radioNames) {
      const radioGroup = nativeRadios.filter((radio) => (radio.name || "__unnamed") === name);
      const matchedProfile = profileMatch(contextText(radioGroup[0], root), "radio");
      const result = chooseOne(radioGroup, matchedProfile?.value);
      if (result.personalized) personalized = true;
    }

    const roleCheckboxes = Array.from(root.querySelectorAll('[role="checkbox"]')).filter(visible);
    if (roleCheckboxes.length && !roleCheckboxes.some(isSelected)) safeClick(roleCheckboxes[0]);
    const nativeCheckboxes = Array.from(root.querySelectorAll('input[type="checkbox"]')).filter(visible);
    if (nativeCheckboxes.length && !nativeCheckboxes.some(isSelected)) safeClick(nativeCheckboxes[0]);

    const listboxes = Array.from(root.querySelectorAll('[role="listbox"]')).filter(visible);
    for (const listbox of listboxes) {
      const matchedProfile = profileMatch(contextText(listbox, root), "listbox");
      const result = await fillListbox(listbox, matchedProfile?.value);
      if (result.personalized) personalized = true;
    }

    return { answered: rootAnswered(root), unsupported: fileInputs.length > 0, personalized };
  }

  try {
    const roots = questionRoots();
    let filled = 0;
    let unsupported = 0;
    let personalized = 0;
    for (const root of roots) {
      const result = await fillRoot(root);
      if (result.answered) filled += 1;
      if (result.unsupported && !result.answered) unsupported += 1;
      if (result.personalized) personalized += 1;
      await wait(40);
    }

    if (window.QRSurveyNative && typeof window.QRSurveyNative.report === "function") {
      window.QRSurveyNative.report(JSON.stringify({ filled, total: roots.length, unsupported, personalized }));
    }
  } catch (error) {
    if (window.QRSurveyNative && typeof window.QRSurveyNative.report === "function") {
      window.QRSurveyNative.report(JSON.stringify({ filled: 0, total: 0, unsupported: 0, personalized: 0, error: String(error) }));
    }
  } finally {
    window.__qrSurveyAutofillRunning = false;
  }
})();
