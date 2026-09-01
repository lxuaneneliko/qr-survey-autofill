import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../android/app/src/main/assets/custom_rule_matching.js", import.meta.url), "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context);

const matcher = context.window.QRSurveyCustomRuleMatching;

test("parses saved keyword and reply pairs", () => {
  const rules = matcher.parse(JSON.stringify([
    { keyword: "最喜歡的顏色、偏好顏色", reply: "綠色" },
    { keyword: "未完成" },
  ]));
  assert.equal(rules.length, 1);
  assert.deepEqual(Array.from(rules[0].aliases), ["最喜歡的顏色", "偏好顏色"]);
  assert.equal(rules[0].reply, "綠色");
});

test("matches any alias and reports the applied keyword", () => {
  const rules = [{ keyword: "最喜歡的顏色、偏好顏色", reply: "綠色" }];
  const result = matcher.match(rules, "請選擇你的偏好顏色");
  assert.equal(result.value, "綠色");
  assert.equal(result.label, "自訂：最喜歡的顏色");
});

test("uses the first saved matching rule", () => {
  const rules = [
    { keyword: "飲料", reply: "綠茶" },
    { keyword: "最喜歡的飲料", reply: "咖啡" },
  ];
  assert.equal(matcher.match(rules, "最喜歡的飲料是什麼？").value, "綠茶");
});

test("ignores incomplete, malformed, and one-character keywords", () => {
  assert.equal(matcher.match("not json", "任何題目"), null);
  assert.equal(matcher.match([{ keyword: "顏色", reply: "" }], "顏色"), null);
  assert.equal(matcher.match([{ keyword: "名", reply: "小明" }], "姓名"), null);
});

test("limits persisted rules to twelve", () => {
  const sourceRules = Array.from({ length: 15 }, (_, index) => ({ keyword: `題目${index}`, reply: `回答${index}` }));
  assert.equal(matcher.parse(sourceRules).length, 12);
});
