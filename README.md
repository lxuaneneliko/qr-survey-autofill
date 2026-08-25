# 掃表｜不想填表單？幫你填

掃表是一款 Android QR Code 表單自動填寫工具。掃描 Google 表單或其他 HTTPS 問卷後，App 會在內建的安全 WebView 中讀取題目、自動產生測試回答並填入欄位，最後停在提交前讓使用者檢查。

> App 不會自動按下「提交」。使用者應確認答案符合表單要求後再自行送出。

## 下載 APK

[前往 GitHub Releases 下載 APK](https://github.com/lxuaneneliko/qr-survey-autofill/releases)

目前測試版本使用 Android Debug Key 簽章，適合自行安裝與功能測試，沒有上架 Google Play。

## 流程

1. 開啟 App 並允許相機權限。
2. 掃描包含 HTTPS 表單網址的 QR Code。
3. App 內建表單頁載入題目並自動填寫。
4. 使用者檢查答案並自行按下提交。

## 支援題型

- 簡答、長答、Email、電話、數字與網址
- 單選、多選與常見量表
- 原生下拉選單與 ARIA listbox
- 日期、時間、月份與 datetime-local
- Google Forms 以及使用標準 HTML／ARIA 控制項的常見 HTTPS 表單

檔案上傳、CAPTCHA、登入驗證，以及用 Canvas 或完全自訂元件製作的題型可能需要手動處理。表單網站改版後，選擇器也可能需要跟著更新。

## 回答規則

App 使用本機固定規則產生測試內容，例如姓名、Email、電話、日期與一般文字，不會把題目送到 AI 服務或其他伺服器。單選與多選會選擇可用選項，數字量表預設選擇中間值。

## 隱私與安全

- 僅接受 `https://` 網址。
- 不儲存掃描紀錄或表單答案。
- 不會自動提交表單。
- WebView 的原生橋接只能回報已填題數，不能讀取或傳出答案。
- 完整說明請見 [PRIVACY.md](PRIVACY.md)。

## 本機建置

需求：Node.js 22+、Java 21、Android SDK。

```powershell
npm.cmd install
npm.cmd run check
npm.cmd run android:sync
cd android
.\gradlew.bat :app:assembleDebug
```

APK 輸出位置：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 專案結構

- `web/`：不需打包器的掃描首頁。
- `android/`：Capacitor Android 專案與自動填寫 Activity。
- `android/app/src/main/assets/form_autofill.js`：表單題型辨識與自動填寫引擎。
- `FormFillActivity.java`：安全 WebView、狀態列與 JavaScript 注入。
- `FormAutofillPlugin.java`：Capacitor 與原生表單頁面的橋接。

## 使用責任

請勿利用本工具大量提交垃圾回覆、規避驗證或違反表單服務條款。App 的定位是減少重複輸入；最後內容確認與提交責任仍由使用者承擔。
