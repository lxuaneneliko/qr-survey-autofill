(function (global) {
  "use strict";

  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const lower = (value) => normalize(value).toLowerCase();
  const thirdParty = /緊急|聯絡人|監護人|家長|父親|母親|父母|推薦人|介紹人|指導教授|老師|導師|主管|負責人|代理人|emergency|guardian|parent|referrer|supervisor|teacher|contact\s*person/;
  const workContext = /公司|職場|工作單位|任職|雇主|company|employer|workplace|organization/;

  function comparable(value) {
    const text = lower(value).replace(/臺/g, "台");
    const compact = text.replace(/[\s()（）【】\[\]、,，.。/／_\-]/g, "");
    if (/碩一|碩士一年級|研究所一年級|master1/.test(compact)) return "__master1";
    if (/碩二|碩士二年級|研究所二年級|master2/.test(compact)) return "__master2";
    if (/碩士|研究所|master|graduate/.test(compact)) return "__master";
    if (/博士|phd|doctoral/.test(compact)) return "__phd";
    if (/大一|一年級|1年級|freshman|firstyear|year1/.test(compact)) return "__grade1";
    if (/大二|二年級|2年級|sophomore|secondyear|year2/.test(compact)) return "__grade2";
    if (/大三|三年級|3年級|junior|thirdyear|year3/.test(compact)) return "__grade3";
    if (/大四|四年級|4年級|senior|fourthyear|year4/.test(compact)) return "__grade4";
    if (/大五|五年級|5年級|fifthyear|year5/.test(compact)) return "__grade5";
    return compact;
  }

  function matchesOption(candidateValue, preferredValue) {
    const candidate = comparable(candidateValue);
    const preferred = comparable(preferredValue);
    if (!candidate || !preferred) return false;
    if (candidate === preferred) return true;
    if (candidate.startsWith("__") || preferred.startsWith("__")) {
      return candidate.includes(preferred) || preferred.includes(candidate);
    }
    return (preferred.length >= 3 && candidate.includes(preferred))
      || (candidate.length >= 3 && preferred.includes(candidate));
  }

  function result(key, label, value, confidence, reason) {
    return { key, label, value: normalize(value), confidence, reason };
  }

  function match(profile, rawContext, rawType) {
    const context = lower(rawContext);
    const type = lower(rawType || "text");
    if (!context || thirdParty.test(context)) return null;

    if (profile.email && (type === "email" || /gmail|e-?mail|電子郵件|電子信箱|信箱|郵件地址/.test(context))) {
      return result("email", "Gmail", profile.email, type === "email" ? 1 : 0.96, "email");
    }

    if (profile.department && /系所|科系|學系|院系|主修|department|major/.test(context) && !workContext.test(context)) {
      return result("department", "科系", profile.department, 0.95, "department");
    }

    const gradeQuestion = /年級|就讀年|目前年級|grade|year\s*(of\s*)?(study|school)/.test(context);
    const gradeExclusion = /成績|分數|等第|gpa|grade\s*point|畢業年度|入學年度|學年度|學籍狀態/.test(context);
    if (profile.grade && gradeQuestion && !gradeExclusion) {
      return result("grade", "年級", profile.grade, 0.94, "grade");
    }

    if (profile.university && /就讀學校|學校名稱|校名|大學|院校|university|college|school/.test(context) && !workContext.test(context)) {
      return result("university", "大學", profile.university, 0.94, "university");
    }

    const nameQuestion = /姓名|名字|全名|您的稱呼|你的稱呼|full\s*name|your\s*name|\bname\b/.test(context);
    const nameExclusion = /公司|單位|組織|品牌|活動|社團|專案|團隊|company|organization|business|brand|event|project|team/;
    if (profile.name && nameQuestion && !nameExclusion.test(context)) {
      return result("name", "姓名", profile.name, 0.96, "name");
    }

    return null;
  }

  global.QRSurveyProfileMatching = { comparable, match, matchesOption, normalize };
})(window);
