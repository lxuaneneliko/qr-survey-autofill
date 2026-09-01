(function (global) {
  "use strict";

  const MAX_RULES = 12;
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const lower = (value) => normalize(value).toLowerCase();

  function aliasesFor(keyword) {
    return String(keyword || "")
      .split(/[\n,，、/／|｜;；]+/)
      .map(lower)
      .filter((alias, index, aliases) => alias.length >= 2 && aliases.indexOf(alias) === index)
      .slice(0, 10);
  }

  function parse(rawRules) {
    let source = rawRules;
    if (typeof source === "string") {
      try {
        source = JSON.parse(source || "[]");
      } catch {
        source = [];
      }
    }
    if (!Array.isArray(source)) return [];

    return source.slice(0, MAX_RULES).map((rule) => {
      const keyword = normalize(rule && rule.keyword).slice(0, 120);
      const reply = normalize(rule && (rule.reply ?? rule.response)).slice(0, 500);
      return { keyword, reply, aliases: aliasesFor(keyword) };
    }).filter((rule) => rule.keyword && rule.reply && rule.aliases.length);
  }

  function match(rawRules, rawContext) {
    const context = lower(rawContext);
    if (!context) return null;
    const rule = parse(rawRules).find((candidate) => candidate.aliases.some((alias) => context.includes(alias)));
    if (!rule) return null;
    const displayKeyword = rule.aliases[0].length > 18 ? `${rule.aliases[0].slice(0, 18)}…` : rule.aliases[0];
    return {
      key: "customRule",
      label: `自訂：${displayKeyword}`,
      value: rule.reply,
      confidence: 1,
      reason: "custom-keyword",
    };
  }

  global.QRSurveyCustomRuleMatching = { MAX_RULES, aliasesFor, match, normalize, parse };
})(window);
