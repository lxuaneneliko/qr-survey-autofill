package com.lxuan.qrsurvey;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

public class FormFillActivity extends AppCompatActivity {
    public static final String EXTRA_URL = "form_url";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private TextView statusView;
    private ProgressBar progressBar;
    private String autofillScript = "";

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        String url = getIntent().getStringExtra(EXTRA_URL);
        if (!isSafeUrl(url)) {
            Toast.makeText(this, "這不是安全的 HTTPS 表單網址", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        try {
            autofillScript = readAsset("form_autofill.js");
        } catch (IOException error) {
            Toast.makeText(this, "無法載入自動填寫功能", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        getWindow().setStatusBarColor(Color.rgb(9, 25, 20));
        getWindow().setNavigationBarColor(Color.rgb(9, 25, 20));
        setContentView(createLayout());

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setUserAgentString(settings.getUserAgentString() + " QRSurveyAutofill/1.1");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new AutofillBridge(), "QRSurveyNative");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress < 100 ? View.VISIBLE : View.GONE);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme())) {
                    return false;
                }
                Toast.makeText(FormFillActivity.this, "已阻擋非 HTTPS 連結", Toast.LENGTH_SHORT).show();
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String pageUrl) {
                super.onPageFinished(view, pageUrl);
                statusView.setText("正在讀取題目並自動填寫…");
                injectAutofill(250);
                injectAutofill(1_000);
                injectAutofill(2_500);
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });

        webView.loadUrl(url);
    }

    private View createLayout() {
        int padding = dp(16);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(padding, dp(10), dp(8), dp(9));
        toolbar.setBackgroundColor(Color.rgb(19, 42, 36));

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        statusView = new TextView(this);
        statusView.setText("正在開啟表單…");
        statusView.setTextColor(Color.WHITE);
        statusView.setTextSize(15);
        statusView.setTypeface(statusView.getTypeface(), android.graphics.Typeface.BOLD);

        TextView hintView = new TextView(this);
        hintView.setText("答案不會自動送出，請檢查後自行提交");
        hintView.setTextColor(Color.rgb(190, 207, 200));
        hintView.setTextSize(11);
        hintView.setPadding(0, dp(2), 0, 0);

        copy.addView(statusView);
        copy.addView(hintView);

        Button closeButton = new Button(this);
        closeButton.setText("關閉");
        closeButton.setTextColor(Color.rgb(202, 255, 82));
        closeButton.setTextSize(12);
        closeButton.setAllCaps(false);
        closeButton.setBackgroundColor(Color.TRANSPARENT);
        closeButton.setOnClickListener(view -> finish());

        toolbar.addView(copy);
        toolbar.addView(closeButton, new LinearLayout.LayoutParams(dp(70), dp(48)));

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.rgb(202, 255, 82)));
        progressBar.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(35, 70, 60)));
        progressBar.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(3)));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        webView.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0,
            1
        ));

        root.addView(toolbar);
        root.addView(progressBar);
        root.addView(webView);
        return root;
    }

    private void injectAutofill(long delayMillis) {
        handler.postDelayed(() -> {
            if (webView != null && !autofillScript.isEmpty()) {
                webView.evaluateJavascript(autofillScript, null);
            }
        }, delayMillis);
    }

    private boolean isSafeUrl(String value) {
        if (value == null) return false;
        try {
            Uri uri = Uri.parse(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null;
        } catch (Exception error) {
            return false;
        }
    }

    private String readAsset(String filename) throws IOException {
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
            getAssets().open(filename), StandardCharsets.UTF_8
        ))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line).append('\n');
            }
        }
        return builder.toString();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private final class AutofillBridge {
        @JavascriptInterface
        public void report(String rawReport) {
            runOnUiThread(() -> {
                try {
                    JSONObject report = new JSONObject(rawReport);
                    int filled = report.optInt("filled", 0);
                    int total = report.optInt("total", 0);
                    int unsupported = report.optInt("unsupported", 0);
                    if (filled > 0) {
                        String suffix = unsupported > 0 ? "，另有 " + unsupported + " 題需手動處理" : "";
                        statusView.setText("已自動填寫 " + filled + "／" + total + " 題" + suffix);
                    } else if (total > 0) {
                        statusView.setText("找到題目，但這個表單需手動處理");
                    } else {
                        statusView.setText("找不到可自動填寫的表單題目");
                    }
                } catch (Exception error) {
                    statusView.setText("表單已開啟，請檢查自動填寫結果");
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.removeJavascriptInterface("QRSurveyNative");
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
