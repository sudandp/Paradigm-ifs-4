# Task Plan: 100% Free Offline OCR & Snipping Tool Implementation

> **Objective:** Deliver reliable, completely offline on-device OCR on Android with zero recurring API costs, instant text extraction (<1s), support for English + Indian languages (Devanagari/Hindi), and a Windows 11 Snipping Tool-like user interface with Copy/Edit/Export actions.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       OFFLINE OCR HYBRID ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [User Image Input: Camera / Gallery / Scanned Document / Screenshot]       │
│                                  │                                          │
│                                  ▼                                          │
│                    ┌───────────────────────────┐                            │
│                    │  Aadhaar QR Fast-Path?    │ ──► [YES] ──► Instant Data │
│                    │   (jsQR + 2048-bit Pako)  │                            │
│                    └─────────────┬─────────────┘                            │
│                                  │ [NO]                                     │
│                                  ▼                                          │
│                    ┌───────────────────────────┐                            │
│                    │    Platform Detection     │                            │
│                    └──────┬─────────────┬──────┘                            │
│                           │             │                                   │
│            [Android Native]             [Web / PWA / Desktop]               │
│                           ▼             ▼                                   │
│            ┌────────────────────┐ ┌────────────────────┐                    │
│            │ Google ML Kit v2   │ │ Tesseract.js (WASM)│                    │
│            │ Bundled On-Device  │ │ + PDF.js Worker    │                    │
│            │ • Latin (English)  │ │ • English Model    │                    │
│            │ • Devanagari (Hin) │ │ • Cross-Platform   │                    │
│            │ • ~500ms Latency   │ │ • Scanned PDF Loop │                    │
│            └─────────┬──────────┘ └─────────┬──────────┘                    │
│                      │                      │                               │
│                      └──────────┬───────────┘                               │
│                                 ▼                                           │
│                 Unified Field & Token Normalizer                            │
│               (PAN, Aadhaar, Bank, Cheque, General)                         │
│                                 │                                           │
│               ┌─────────────────┴─────────────────┐                         │
│               ▼                                   ▼                         │
│    Form Auto-Fill Integration           Snipping Tool Actions               │
│    (Onboarding / Documents)             • 1-Click Copy to Clipboard         │
│                                         • In-place Text Edit                │
│                                         • Export to .TXT / Share            │
│                                         • Bounding Box Sub-Crop             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Implementation Steps

### Step 1: Add Bundled ML Kit Dependencies in `android/app/build.gradle`
- Add `com.google.mlkit:text-recognition:16.0.1` (Latin / English).
- Add `com.google.mlkit:text-recognition-devanagari:16.0.1` (Devanagari / Hindi, Marathi).

### Step 2: Implement Native Android Capacitor Plugin `MlKitOcrPlugin.java`
- Location: `android/app/src/main/java/com/paradigm/ifs/MlKitOcrPlugin.java`
- Features:
  - `@PluginMethod public void processImage(PluginCall call)`
  - Decodes base64 or file URI into Android `Bitmap`.
  - Automatically reads EXIF orientation.
  - Runs bundled `TextRecognition.getClient(options)` asynchronously on background thread.
  - Constructs hierarchical structured JSON response:
    - `fullText: string`
    - `blocks: Array<{ text: string, box: { x, y, width, height }, lines: ... }>`
    - `lines: Array<{ text: string, confidence: number, box: ... }>`
    - `latencyMs: number`
  - Register in `MainActivity.java`: `registerPlugin(MlKitOcrPlugin.class)`.

### Step 3: TypeScript Native Bridge & Engine Routing Layer
- Location: `services/offline/mlkitOcrPlugin.ts`
- Define Capacitor plugin proxy with fallback detection (`isPluginAvailable('MlKitOcr')`).
- Hook into `services/offline/offlineExtraction.ts`:
  - When running on Android Native, bypass Tesseract.js image-rasterization loop and invoke `MlKitOcr.processImage()`.
  - Pass the structured OCR lines directly into existing token normalizers and regex rules.
- Update `services/api.ts`:
  - Direct all document extraction requests to `extractDataOffline()` to enforce 100% offline mode with zero cloud API dependency.

### Step 4: Snipping Tool User Interface & Raw Text Actions
- Location: `components/ocr/SnippingToolModal.tsx`
- Features:
  - Freeform box selection overlay (pinch, drag, resize).
  - Instant live OCR extraction of selected region (<500ms).
  - Floating action pill:
    - 📋 **Copy to Clipboard** (`@capacitor/clipboard`).
    - ✏️ **Edit Text** (interactive textarea).
    - 📤 **Export / Share** (system share sheet).
    - ⚡ **Auto-fill Field** (when launched from a specific document input).
- Integration in `components/UploadDocument.tsx` and `pages/onboarding/PreUpload.tsx`:
  - Add "✂️ Snip & Extract" button next to standard file upload and camera capture.

### Step 5: Verification & Quality Assurance
1. Run `vitest` unit tests.
2. Run `npx tsc --noEmit` type checking.
3. Compile Android debug bundle: `npx cap sync android`.
4. Compile Debug APK via Gradle: `node scripts/compile-apk.js`.
5. Install on connected Samsung Galaxy device (`R9ZL20MN6SD`).
6. Test in **Airplane Mode**:
   - PAN card extraction.
   - Aadhaar card extraction.
   - Cheque leaf extraction.
   - Freeform Snipping Tool box crop and clipboard copy.
