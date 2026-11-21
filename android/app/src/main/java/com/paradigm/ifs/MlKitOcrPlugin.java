package com.paradigm.ifs;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.net.Uri;
import android.util.Base64;
import android.util.Log;

import androidx.exifinterface.media.ExifInterface;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.tasks.Task;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions;

import java.io.InputStream;

@CapacitorPlugin(name = "MlKitOcr")
public class MlKitOcrPlugin extends Plugin {

    private static final String TAG = "MlKitOcrPlugin";

    private TextRecognizer latinRecognizer;
    private TextRecognizer devanagariRecognizer;

    @Override
    public void load() {
        super.load();
        try {
            latinRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            devanagariRecognizer = TextRecognition.getClient(new DevanagariTextRecognizerOptions.Builder().build());
            Log.d(TAG, "MlKitOcrPlugin initialized successfully with Latin and Devanagari engines.");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize ML Kit Text Recognizers: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        JSArray engines = new JSArray();
        engines.put("latin");
        engines.put("devanagari");
        ret.put("engines", engines);
        call.resolve(ret);
    }

    @PluginMethod
    public void processImage(PluginCall call) {
        final long startTime = System.currentTimeMillis();
        final String imageInput = call.getString("image");
        final String script = call.getString("script", "latin");
        final JSObject cropBox = call.getObject("cropBox", null);

        if (imageInput == null || imageInput.trim().isEmpty()) {
            call.reject("Image data or URI is required");
            return;
        }

        // Execute background decoding and recognition to keep UI thread 100% fluid
        getBridge().execute(() -> {
            Bitmap decodedBitmap = null;
            Bitmap targetBitmap = null;
            try {
                decodedBitmap = decodeBitmapFromInput(imageInput);
                if (decodedBitmap == null) {
                    call.reject("Failed to decode image bitmap from provided source");
                    return;
                }

                targetBitmap = applyOptionalCrop(decodedBitmap, cropBox);

                // Select recognizer (Devanagari model supports both Devanagari script and Latin numbers/text)
                TextRecognizer recognizer = latinRecognizer;
                if (("devanagari".equalsIgnoreCase(script) || "auto".equalsIgnoreCase(script) || "hindi".equalsIgnoreCase(script) || "indic".equalsIgnoreCase(script)) && devanagariRecognizer != null) {
                    recognizer = devanagariRecognizer;
                } else if (recognizer == null) {
                    recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
                }

                InputImage inputImage = InputImage.fromBitmap(targetBitmap, 0);

                final Bitmap finalTargetBitmap = targetBitmap;
                final Bitmap finalDecodedBitmap = decodedBitmap;

                recognizer.process(inputImage)
                        .addOnSuccessListener(visionText -> {
                            try {
                                JSObject result = new JSObject();
                                String fullText = visionText.getText() != null ? visionText.getText() : "";
                                result.put("fullText", fullText);
                                result.put("engine", "mlkit-" + script);
                                result.put("latencyMs", System.currentTimeMillis() - startTime);

                                JSArray blocksArray = new JSArray();
                                JSArray linesArray = new JSArray();

                                for (Text.TextBlock block : visionText.getTextBlocks()) {
                                    JSObject blockObj = new JSObject();
                                    blockObj.put("text", block.getText());

                                    Rect bRect = block.getBoundingBox();
                                    if (bRect != null) {
                                        JSObject bBox = new JSObject();
                                        bBox.put("x", bRect.left);
                                        bBox.put("y", bRect.top);
                                        bBox.put("width", bRect.width());
                                        bBox.put("height", bRect.height());
                                        blockObj.put("box", bBox);
                                    }

                                    JSArray blockLines = new JSArray();
                                    for (Text.Line line : block.getLines()) {
                                        JSObject lineObj = new JSObject();
                                        lineObj.put("text", line.getText());
                                        lineObj.put("confidence", line.getConfidence());

                                        Rect lRect = line.getBoundingBox();
                                        if (lRect != null) {
                                            JSObject lBox = new JSObject();
                                            lBox.put("x", lRect.left);
                                            lBox.put("y", lRect.top);
                                            lBox.put("width", lRect.width());
                                            lBox.put("height", lRect.height());
                                            lineObj.put("box", lBox);
                                        }

                                        blockLines.put(lineObj);
                                        linesArray.put(lineObj);
                                    }
                                    blockObj.put("lines", blockLines);
                                    blocksArray.put(blockObj);
                                }

                                result.put("lines", linesArray);
                                result.put("blocks", blocksArray);
                                call.resolve(result);
                            } catch (Exception parseErr) {
                                Log.e(TAG, "Error building ML Kit result payload", parseErr);
                                call.reject("Error parsing OCR result: " + parseErr.getMessage());
                            } finally {
                                recycleSafely(finalTargetBitmap);
                                if (finalDecodedBitmap != finalTargetBitmap) {
                                    recycleSafely(finalDecodedBitmap);
                                }
                            }
                        })
                        .addOnFailureListener(e -> {
                            Log.e(TAG, "ML Kit OCR failed: " + e.getMessage(), e);
                            recycleSafely(finalTargetBitmap);
                            if (finalDecodedBitmap != finalTargetBitmap) {
                                recycleSafely(finalDecodedBitmap);
                            }
                            call.reject("ML Kit Text Recognition failed: " + e.getMessage(), e);
                        });

            } catch (Exception err) {
                Log.e(TAG, "Failed in processImage execution", err);
                recycleSafely(targetBitmap);
                if (decodedBitmap != targetBitmap) {
                    recycleSafely(decodedBitmap);
                }
                call.reject("Failed to process image with ML Kit: " + err.getMessage(), err);
            }
        });
    }

    private Bitmap decodeBitmapFromInput(String input) throws Exception {
        Context context = getContext();

        // 1. Check if base64 data URL
        if (input.startsWith("data:") && input.contains(",")) {
            String base64Data = input.substring(input.indexOf(",") + 1);
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        }

        // 2. Check if raw base64 string
        if (!input.startsWith("content://") && !input.startsWith("file://") && input.length() > 200 && !input.contains("/")) {
            byte[] bytes = Base64.decode(input, Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        }

        // 3. Blob URLs must be resolved on frontend canvas
        if (input.startsWith("blob:")) {
            throw new IllegalArgumentException("Blob URI cannot be read by Android ContentResolver; convert to Base64 in WebView before passing.");
        }

        // 4. Otherwise treat as content / file URI
        Uri uri = Uri.parse(input);
        try (InputStream is = context.getContentResolver().openInputStream(uri)) {
            Bitmap bitmap = BitmapFactory.decodeStream(is);
            if (bitmap == null) return null;

            // Handle EXIF orientation rotation
            try (InputStream exifStream = context.getContentResolver().openInputStream(uri)) {
                if (exifStream != null) {
                    ExifInterface exif = new ExifInterface(exifStream);
                    int orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
                    int rotationAngle = 0;
                    if (orientation == ExifInterface.ORIENTATION_ROTATE_90) rotationAngle = 90;
                    else if (orientation == ExifInterface.ORIENTATION_ROTATE_180) rotationAngle = 180;
                    else if (orientation == ExifInterface.ORIENTATION_ROTATE_270) rotationAngle = 270;

                    if (rotationAngle != 0) {
                        Matrix matrix = new Matrix();
                        matrix.postRotate(rotationAngle);
                        Bitmap rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
                        if (rotated != bitmap) {
                            bitmap.recycle();
                            bitmap = rotated;
                        }
                    }
                }
            } catch (Exception exifErr) {
                Log.w(TAG, "EXIF inspection skipped: " + exifErr.getMessage());
            }

            return bitmap;
        }
    }

    private Bitmap applyOptionalCrop(Bitmap src, JSObject cropBox) {
        if (cropBox == null || src == null) return src;

        try {
            double rx = cropBox.optDouble("x", 0.0);
            double ry = cropBox.optDouble("y", 0.0);
            double rw = cropBox.optDouble("width", 1.0);
            double rh = cropBox.optDouble("height", 1.0);

            int imgW = src.getWidth();
            int imgH = src.getHeight();

            int px, py, pw, ph;

            // If coordinates are normalized (0.0 to 1.0)
            if (rw <= 1.0 && rh <= 1.0 && rx < 1.0 && ry < 1.0) {
                px = (int) Math.round(rx * imgW);
                py = (int) Math.round(ry * imgH);
                pw = (int) Math.round(rw * imgW);
                ph = (int) Math.round(rh * imgH);
            } else {
                // Pixel coordinates
                px = (int) Math.round(rx);
                py = (int) Math.round(ry);
                pw = (int) Math.round(rw);
                ph = (int) Math.round(rh);
            }

            // Clamp bounds
            px = Math.max(0, Math.min(px, imgW - 1));
            py = Math.max(0, Math.min(py, imgH - 1));
            pw = Math.max(1, Math.min(pw, imgW - px));
            ph = Math.max(1, Math.min(ph, imgH - py));

            if (pw <= 10 || ph <= 10) return src;

            Bitmap cropped = Bitmap.createBitmap(src, px, py, pw, ph);
            Log.d(TAG, "Applied native crop: x=" + px + ", y=" + py + ", w=" + pw + ", h=" + ph);
            return cropped;
        } catch (Exception e) {
            Log.w(TAG, "Failed to apply cropBox, using original bitmap: " + e.getMessage());
            return src;
        }
    }

    private void recycleSafely(Bitmap b) {
        if (b != null && !b.isRecycled()) {
            b.recycle();
        }
    }
}
