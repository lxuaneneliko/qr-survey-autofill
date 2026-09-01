# 掃表｜不想填表單？幫你填

掃表是一款 Android QR Code 表單自動填寫工具。掃描 Google 表單或其他 HTTPS 問卷後，App 會在內建的安全 WebView 中讀取題目、自動產生測試回答並填入欄位，最後停在提交前讓使用者檢查。

> App 不會自動按下「提交」。使用者應確認答案符合表單要求後再自行送出。

## 下載 APK

[前往 GitHub Releases 下載 APK](https://github.com/lxuaneneliko/qr-survey-autofill/releases)

目前測試版本使用 Android Debug Key 簽章，適合自行安裝與功能測試，沒有上架 Google Play。

## 流程

1. 開啟 App 並允許相機權限。
2. 點首頁右上角「我的資料」，可選填姓名、Gmail／Email、大學、科系、年級與學號，修改長答題的預設回答，或新增最多 12 組「題目關鍵詞 → 回覆」。
3. 用相機掃描 QR Code、從圖庫選擇 QR Code 圖片，或在掃描框下方貼上 HTTPS 表單連結。
4. App 內建表單頁載入題目並自動填寫；套用順序為基本資料、自訂關鍵詞回覆、通用回答，並在頂端列出實際套用項目。
5. 使用者檢查答案並自行按下提交。

## 支援題型

- 簡答、長答、Email、電話、數字與網址
- 單選、多選與常見量表
- 原生下拉選單與 ARIA listbox
- 日期、時間、月份與 datetime-local
- Google Forms 以及使用標準 HTML／ARIA 控制項的常見 HTTPS 表單

檔案上傳、CAPTCHA、登入驗證，以及用 Canvas 或完全自訂元件製作的題型可能需要手動處理。表單網站改版後，選擇器也可能需要跟著更新。

## 回答規則

App 使用本機固定規則產生測試內容，例如姓名、Email、電話、日期與一般文字，不會把題目送到 AI 服務或其他伺服器。單選與多選會選擇可用選項，數字量表預設選擇中間值。

使用者儲存基本資料後，App 會比對題目標題、欄位標籤、提示文字與選項。只有高信心匹配才會套用；例如「姓名／全名」對應姓名、「Gmail／電子信箱」對應 Email、「大學／院校」對應學校、「學號／Student ID」對應學號。第三方聯絡人、公司名稱、GPA、學籍狀態等容易混淆的欄位會跳過。個人資料選單找不到相符選項時會保持未選，不會退回亂選第一項。

「預設長文字回答」可在我的資料頁自行修改，會套用到意見、建議、原因、心得、說明與其他長答題。未設定時使用「這是由掃表自動產生並填入的回覆。」。

「自訂關鍵詞回覆」可新增最多 12 組，例如「最喜歡的顏色 → 綠色」。同一組的多個同義詞可用頓號、逗號或斜線分隔。簡答與長答會直接填入指定回覆；單選、多選與下拉選單只有在回覆能對上現有選項時才會選取，對不上就保持空白。若多組規則同時符合，會使用清單中最上方的一組。

## 隱私與安全

- 僅接受 `https://` 網址。
- 圖庫圖片只在 Android 裝置本機辨識，不會上傳。
- 手動貼上的連結只用來開啟表單，不會儲存。
- 基本資料、自訂預設回答及關鍵詞回覆規則只存在 App 私有的本機儲存空間，不納入 Android 備份；不會要求或儲存 Gmail 密碼。
- 不確定的題目不會套用基本資料，已手動填寫的欄位也不會被覆蓋。
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
- `android/app/src/main/assets/custom_rule_matching.js`：自訂關鍵詞與回覆的本機比對規則。
- `FormFillActivity.java`：安全 WebView、狀態列與 JavaScript 注入。
- `FormAutofillPlugin.java`：Capacitor 與原生表單頁面的橋接。

## 使用責任

請勿利用本工具大量提交垃圾回覆、規避驗證或違反表單服務條款。App 的定位是減少重複輸入；最後內容確認與提交責任仍由使用者承擔。
