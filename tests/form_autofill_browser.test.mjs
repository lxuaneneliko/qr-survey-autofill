import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const browserCandidates = [
  process.env.CHROME_BIN,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const browserPath = browserCandidates.find(existsSync);

function runFixture(filename, tagName) {
  const fixtureUrl = pathToFileURL(fileURLToPath(new URL(`./fixtures/${filename}`, import.meta.url))).href;
  const result = spawnSync(browserPath, [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--no-first-run",
    "--virtual-time-budget=5000",
    "--dump-dom",
    fixtureUrl,
  ], { encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  const startTag = `<${tagName} id="report">`;
  const start = result.stdout.indexOf(startTag);
  assert.notEqual(start, -1, "The fixture did not report an autofill result");
  const end = result.stdout.indexOf(`</${tagName}>`, start);
  assert.notEqual(end, -1);
  return JSON.parse(result.stdout.slice(start + startTag.length, end));
}

test("fills mixed question containers, editable text, and legacy default without overwriting answers", { skip: !browserPath }, () => {
  const result = runFixture("mixed-form.html", "output");
  assert.equal(result.summary.filled, 6);
  assert.equal(result.summary.total, 8);
  assert.equal(result.summary.unsupported, 1);
  assert.equal(result.short, "無");
  assert.equal(result.long, "無");
  assert.equal(result.plain, "無");
  assert.equal(result.editable, "無");
  assert.equal(result.choice, "a");
  assert.equal(result.manual, "手動內容");
  assert.equal(result.invalidEmail, "");
});

test("retains profile and custom answers ahead of generic text fallback", { skip: !browserPath }, () => {
  const result = runFixture("profile-form.html", "div");
  assert.equal(result.summary.filled, 10);
  assert.equal(result.summary.total, 10);
  assert.equal(result.name, "王小明");
  assert.equal(result.studentId, "B01234567");
  assert.equal(result.favoriteColor, "綠色");
  assert.equal(result.favoriteDrink, "咖啡");
  assert.equal(result.feedback, "這是我自訂的預設回答。");
});
