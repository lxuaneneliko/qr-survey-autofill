package com.lxuan.qrsurvey;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.LinkedHashMap;
import java.util.Map;

@CapacitorPlugin(name = "Profile")
public class ProfilePlugin extends Plugin {
    private static final String STORE_NAME = "qr_survey_profile_v2";
    private static final String LEGACY_DEFAULT_ANSWER = "這是由掃表自動產生並填入的回覆。";
    private static final String[] FIELDS = {
        "name", "email", "university", "department", "grade", "studentId", "defaultAnswer", "customRules"
    };

    @PluginMethod
    public void getProfile(PluginCall call) {
        JSObject response = new JSObject();
        SharedPreferences preferences = preferences(getContext());
        for (String field : FIELDS) {
            response.put(field, storedValue(preferences, field));
        }
        call.resolve(response);
    }

    @PluginMethod
    public void saveProfile(PluginCall call) {
        SharedPreferences.Editor editor = preferences(getContext()).edit();
        for (String field : FIELDS) {
            String value = call.getString(field, "");
            editor.putString(field, value == null ? "" : value.trim());
        }
        editor.apply();
        getProfile(call);
    }

    @PluginMethod
    public void clearProfile(PluginCall call) {
        preferences(getContext()).edit().clear().apply();
        getProfile(call);
    }

    static JSONObject readProfile(Context context) {
        SharedPreferences preferences = preferences(context);
        Map<String, String> values = new LinkedHashMap<>();
        for (String field : FIELDS) {
            values.put(field, storedValue(preferences, field));
        }
        return new JSONObject(values);
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(STORE_NAME, Context.MODE_PRIVATE);
    }

    private static String storedValue(SharedPreferences preferences, String field) {
        String value = preferences.getString(field, "");
        return "defaultAnswer".equals(field) && LEGACY_DEFAULT_ANSWER.equals(value) ? "無" : value;
    }
}
