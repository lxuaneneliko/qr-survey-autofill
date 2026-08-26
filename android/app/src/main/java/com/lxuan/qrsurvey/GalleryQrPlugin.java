package com.lxuan.qrsurvey;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;

import java.io.IOException;
import java.util.List;

@CapacitorPlugin(name = "GalleryQr")
public class GalleryQrPlugin extends Plugin {
    @PluginMethod
    public void scanImage(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        startActivityForResult(call, intent, "handleImageResult");
    }

    @ActivityCallback
    private void handleImageResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }

        Uri imageUri = result.getData().getData();
        if (imageUri == null) {
            call.reject("無法讀取選取的圖片", "IMAGE_UNAVAILABLE");
            return;
        }

        final InputImage image;
        try {
            image = InputImage.fromFilePath(getContext(), imageUri);
        } catch (IOException error) {
            call.reject("無法讀取選取的圖片", "IMAGE_UNAVAILABLE", error);
            return;
        }

        BarcodeScannerOptions options = new BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build();
        BarcodeScanner scanner = BarcodeScanning.getClient(options);
        scanner.process(image)
            .addOnSuccessListener(barcodes -> resolveQrResult(call, barcodes, scanner))
            .addOnFailureListener(error -> {
                scanner.close();
                call.reject("圖片辨識失敗，請換一張清楚的 QR Code 圖片", "IMAGE_SCAN_FAILED", error);
            });
    }

    private void resolveQrResult(PluginCall call, List<Barcode> barcodes, BarcodeScanner scanner) {
        scanner.close();
        for (Barcode barcode : barcodes) {
            String rawValue = barcode.getRawValue();
            if (rawValue != null && !rawValue.trim().isEmpty()) {
                JSObject response = new JSObject();
                response.put("ScanResult", rawValue);
                call.resolve(response);
                return;
            }
        }
        call.reject("圖片中找不到 QR Code", "NO_QR_CODE");
    }
}
