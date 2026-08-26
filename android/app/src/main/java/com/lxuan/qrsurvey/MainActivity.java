package com.lxuan.qrsurvey;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(FormAutofillPlugin.class);
        registerPlugin(GalleryQrPlugin.class);
        deleteSharedPreferences("qr_survey_profile");
        super.onCreate(savedInstanceState);
    }
}
