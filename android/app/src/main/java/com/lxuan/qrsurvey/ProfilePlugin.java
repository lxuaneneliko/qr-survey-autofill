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
    private static final String[] FIELDS = {
        "name", "email", "university", "department", "grade", "studentId", "defaultAnswer"
    };

    @PluginMethod
    public void getProfile(PluginCall call) {
        JSObject response = new JSObject();
        SharedPreferences preferences = preferences(getContext());
        for (String field : FIELDS) {
            response.put(field, preferences.getString(field, ""));
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
            values.put(field, preferences.getString(field, ""));
        }
        return new JSONObject(values);
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(STORE_NAME, Context.MODE_PRIVATE);
    }
}
