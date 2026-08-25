package com.lxuan.qrsurvey;

import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FormAutofill")
public class FormAutofillPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String rawUrl = call.getString("url");
        if (rawUrl == null) {
            call.reject("缺少表單網址");
            return;
        }

        Uri uri;
        try {
            uri = Uri.parse(rawUrl);
        } catch (Exception error) {
            call.reject("無效的表單網址");
            return;
        }

        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
            call.reject("僅支援安全的 HTTPS 表單網址");
            return;
        }

        Intent intent = new Intent(getContext(), FormFillActivity.class);
        intent.putExtra(FormFillActivity.EXTRA_URL, uri.toString());
        getActivity().startActivity(intent);

        JSObject result = new JSObject();
        result.put("opened", true);
        call.resolve(result);
    }
}
