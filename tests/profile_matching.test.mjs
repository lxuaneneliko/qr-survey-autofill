import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../android/app/src/main/assets/profile_matching.js", import.meta.url), "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context);

const matcher = context.window.QRSurveyProfileMatching;
const profile = {
  name: "王小明",
  email: "ming@gmail.com",
  university: "國立臺灣海洋大學",
  department: "資訊工程學系",
  grade: "大三",
};

test("matches the five supported personal fields", () => {
  assert.equal(matcher.match(profile, "請填寫您的姓名", "text").key, "name");
  assert.equal(matcher.match(profile, "Gmail 電子信箱", "text").key, "email");
  assert.equal(matcher.match(profile, "目前就讀大學", "text").key, "university");
  assert.equal(matcher.match(profile, "科系／系所", "text").key, "department");
  assert.equal(matcher.match(profile, "目前年級", "select").key, "grade");
});

test("does not leak profile data into third-party or ambiguous fields", () => {
  assert.equal(matcher.match(profile, "緊急聯絡人姓名", "text"), null);
  assert.equal(matcher.match(profile, "公司名稱", "text"), null);
  assert.equal(matcher.match(profile, "GPA 成績", "text"), null);
  assert.equal(matcher.match(profile, "學籍狀態", "select"), null);
  assert.equal(matcher.match(profile, "任職部門", "text"), null);
});

test("normalizes grade choices without accepting unrelated options", () => {
  assert.equal(matcher.matchesOption("三年級（大三）", "大三"), true);
  assert.equal(matcher.matchesOption("大二", "大三"), false);
  assert.equal(matcher.matchesOption("碩士一年級", "碩一"), true);
});

test("requires a saved value before matching", () => {
  assert.equal(matcher.match({ ...profile, email: "" }, "Email", "email"), null);
});
