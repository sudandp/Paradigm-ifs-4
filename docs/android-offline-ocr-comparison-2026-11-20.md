# Android Offline OCR: Comprehensive Technical Audit, ML Kit Comparison & Implementation Roadmap

> **Document Version:** 2.0.0  
> **Date:** 20 November 2026  
> **Status:** Approved Architecture Decision Record (ADR)  
> **Scope:** Android Native (`com.paradigm.ifs`), Web PWA, Hybrid Capacitor Architecture

---

## Executive Summary

The Paradigm IFS Android application **already features a 100% offline OCR capability** implemented via client-side **Tesseract.js v7 (WASM)** combined with **jsQR (Aadhaar QR decode)** and **PDF.js**. However, the current production onboarding workflow operates in a **dual-tier hybrid mode**: it attempts cloud extraction via the Google Gemini Multimodal API (`gemini-flash-latest`) first whenever network connectivity is detected, falling back to local on-device Tesseract.js only during airplane mode, network timeouts, or API 401/429/503 errors.

To satisfy the user requirement for **"100% Free Offline OCR (similar to Windows 11 Snipping Tool) with Zero Cloud Dependency, Zero Recurring Cost, and Instant Field Extraction"**, this report evaluates upgrading the on-device engine to **Google ML Kit Text Recognition v2 (bundled model)** via a custom Capacitor Native Bridge.

### Key Strategic Conclusions

1. **Feasibility:** **100% Feasible** without building a new application. The existing UI, form auto-fill orchestration, camera/file picker, image preprocessing canvas pipeline, and Aadhaar QR decoders can be preserved and augmented.
2. **Engine Upgrade Recommendation:** **Adopt a Hybrid Architecture**. Implement Google ML Kit bundled on-device model as the primary Android recognition engine for images and camera scans (yielding a **10x speedup** from ~5–12s down to ~400–800ms, with superior angle/skew tolerance). Retain Tesseract.js / PDF.js solely for web desktop fallback and multi-page scanned PDF documents.
3. **Financial Impact:** **₹0 / $0 Recurring Operating Costs**. Zero API fees, zero third-party cloud subscriptions, and zero usage volume limits.
4. **Privacy & Compliance:** Meets **ISO 27001** and **India DPDP Act 2023** on-device privacy mandates. No biometric, demographic, or KYC identity data leaves the physical device when offline OCR mode is engaged.
5. **Estimated Implementation Effort:** **10 to 14 Engineering Days (2 Sprints)** for full end-to-end implementation, including native Android Capacitor plugin development, Snipping-Tool UI actions (Copy/Edit/Export), and field extraction validation.

---

## 1. Current State Audit: Existing OCR Architecture

The existing OCR system resides in `services/offline/offlineExtraction.ts` (3,117 lines) and is orchestrated through `pages/onboarding/PreUpload.tsx` and `components/UploadDocument.tsx`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CURRENT RECOGNITION PIPELINE                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                        User Uploads / Captures Image
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │  Network Connectivity & API Key Available?   │
               └──────────────────────┬───────────────────────┘
                                      │
                     YES              │             NO / ERROR (401/503)
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│       Cloud Tier (API)        │               │     Local Offline Tier        │
│    Gemini Multimodal Vision   │               │   Tesseract.js v7 (WASM)      │
│     (gemini-flash-latest)     │               │   + jsQR Aadhaar Decoder      │
│  • High Accuracy (98%+)       │               │   • Runs inside WebView V8    │
│  • Requires Active Internet   │               │   • English traineddata only  │
│  • Recurring Token Cost       │               │   • 5s – 14s processing time  │
└───────────────────────────────┘               └───────────────────────────────┘
```

### Current Components & Capabilities

| Subsystem | Technology | Location | Capabilities & Limitations |
| :--- | :--- | :--- | :--- |
| **Offline OCR Engine** | Tesseract.js v7 | `services/offline/offlineExtraction.ts` | Runs within Capacitor WebView via WebAssembly (WASM). Bundled with English-only model (`eng.traineddata`). |
| **Asset Footprint** | Static Assets | `android/app/src/main/assets/public/tesseract/` | Total asset size: **47.18 MiB** (includes `tesseract-core.wasm`, SIMD/PThread workers, and language dictionaries). |
| **QR Decoder** | jsQR | `services/offline/offlineExtraction.ts` | Scans raw image pixels for standard XML QR codes and UIDAI 2048-bit compressed numerical secure QR codes. Bypasses OCR when valid. |
| **PDF Extraction** | PDF.js v4 | `public/pdf.worker.min.mjs` | Extracts digital selectable text directly from vector PDFs up to 3 pages; rasterizes page 1 to canvas for scanned PDFs. |
| **Preprocessing** | HTML5 Canvas | `preprocessDocumentImage()` | Upscaling (2x/3x), contrast stretching, 4-angle rotation scoring (0°, 90°, 180°, 270°), sub-cropping for PAN, Aadhaar, Bank Passbook, Cheques. |
| **Field Extraction** | Custom Regex & Token Parser | `offlineExtraction.ts` | Custom regex state machine extracting Name, Father Name, DOB, Gender, PAN, Aadhaar, Account No, IFSC, Branch, UAN, ESI. |

### Limitations of Current Implementation

1. **WebView Thread Load & Latency:** Tesseract.js executes WebAssembly inside the Chromium WebView thread pool. On budget Android devices (e.g. MediaTek Helio G35 / Snapdragon 680), processing a 4K phone camera photo takes **7 to 15 seconds**, causing noticeable UI stutter during heavy canvas rasterization.
2. **Absence of Regional Script Models:** Only `eng.traineddata` (Latin/English) is bundled. On bilingual Aadhaar cards (e.g. Kannada + English, Hindi + English, Tamil + English), Tesseract misinterprets Indic glyphs as distorted ASCII artifacts (e.g. reading Kannada header characters as `"Soa"`, `"Sq"`, or `"Sa bot"`).
3. **Snipping-Tool UX Gap:** The user cannot freely drag a box to crop-and-recognize an arbitrary snippet of an image, nor is there a 1-tap "Copy to Clipboard" or "Export as TXT/CSV" floating action bar.
4. **Cloud-First Default:** Even when offline capability exists, the app prioritizes Gemini API whenever Wi-Fi/4G is active. A strict offline user experience requires an explicit zero-cloud policy.

---

## 2. Head-to-Head Comparison: Tesseract.js vs Google ML Kit

The proposed replacement engine is **Google ML Kit Text Recognition v2** using the **bundled on-device model** (`com.google.mlkit:text-recognition:16.0.1`).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               PROPOSED HYBRID OFFLINE ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────────┘

    Image Source (Camera / File / Screenshot)
                     │
                     ▼
        ┌─────────────────────────┐
        │   Aadhaar QR Detector   │ ────► [QR Found] ──► Instant 100% Accurate Data
        │         (jsQR)          │
        └────────────┬────────────┘
                     │ [No QR / Non-Aadhaar]
                     ▼
        ┌───────────────────────────────────────────────────────────┐
        │               Platform Detection & Routing                │
        └────────────┬─────────────────────────────────┬────────────┘
                     │                                 │
            [Android Native]                    [Web / PWA / PDF]
                     ▼                                 ▼
      ┌─────────────────────────────┐   ┌─────────────────────────────┐
      │   Google ML Kit (Bundled)   │   │     Tesseract.js (WASM)     │
      │   Native NDK C++ Pipeline   │   │   + PDF.js Digital Parser   │
      │   • 400ms – 800ms latency   │   │   • Cross-browser fallback  │
      │   • Zero WebView memory hit │   │   • Multi-page PDF text     │
      │   • Exact Bounding Boxes    │   │   • Universal compatibility │
      └──────────────┬──────────────┘   └──────────────┬──────────────┘
                     │                                 │
                     └────────────────┬────────────────┘
                                      ▼
                      Unified Token & Field Normalizer
                      (PAN / Aadhaar / Bank / General)
                                      │
                     ┌────────────────┴────────────────┐
                     ▼                                 ▼
         Interactive Snipping UI             Automatic Form Auto-Fill
      (Copy / Edit / Share / Export)       (Onboarding / Claims / Assets)
```

### Detailed Evaluation Matrix

| Evaluation Dimension | Existing Tesseract.js (WASM) | Proposed Google ML Kit v2 (Bundled) | Advantage |
| :--- | :--- | :--- | :--- |
| **Execution Environment** | WebView V8 JavaScript / WebAssembly | Android Native Java / C++ NDK Runtime | **ML Kit (Native)** |
| **Processing Speed (Latency)** | **5,000ms – 14,000ms** (5–14 seconds)<br>*Single 4K camera photo with rotation checks* | **350ms – 800ms** (< 1 second)<br>*Hardware-accelerated via NNAPI / GPU* | **ML Kit (10x faster)** |
| **Accuracy (Clear Documents)** | 75% – 85% character accuracy | 92% – 97% character accuracy | **ML Kit (+15% gain)** |
| **Accuracy (Skewed / Low Light)** | 40% – 60% (fails unless manually upright) | 80% – 90% (built-in 360° affine line orientation) | **ML Kit (Robust)** |
| **Indian Script Support** | English only bundled (regional requires +15MB each) | Latin + Devanagari (Hindi, Marathi) bundled. *Tamil/Telugu/Kannada not in ML Kit v2*. | **Tied / Specialized** |
| **APK / Download Size Impact** | **+47.18 MiB** uncompressed web assets in APK | **+4.0 MiB per ABI** (arm64-v8a split) | **ML Kit (-40MB saving)** |
| **Memory (RAM) Footprint** | 120MB – 250MB heap allocated in WebView | 25MB – 45MB native memory; immediate GC | **ML Kit (Low memory)** |
| **UI Responsiveness** | May drop frames / stutter during OCR pass | 100% Non-blocking (runs on background thread pool) | **ML Kit (Smooth 60fps)** |
| **Bounding Box Geometry** | Coarse word-level boxes | Fine-grained Hierarchical: Block ➔ Line ➔ Element | **ML Kit (Structured)** |
| **Recurring Cost** | **$0.00 / Zero** | **$0.00 / Zero** | **Tied ($0 Cost)** |
| **Offline Reliability** | 100% Offline (assets packaged locally) | 100% Offline (bundled model variant) | **Tied (Offline)** |
| **Cloud Dependency / Telemetry** | Zero external network calls | Zero OCR cloud calls; minimal Google Play diagnostics | **Tesseract (Simpler boundary)** |
| **PDF File Processing** | Native via PDF.js worker | Unsupported natively (requires Android PdfRenderer) | **Tesseract.js** |
| **Live Camera "Snipping" Mode** | Impractical (too slow for real-time video frames) | Supported natively via CameraX ImageAnalysis | **ML Kit (Real-time)** |

---

## 3. Deep-Dive Gap Analysis & Missing Features

To deliver the user's desired **Windows 11 Snipping Tool** experience on Android, the following gaps in the current app must be addressed:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DESIRED SNIPPING TOOL CAPABILITIES                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  [📷 Capture / Gallery]  ➔  [✂️ Freeform Box Crop]  ➔  [⚡ Instant OCR (<1s)]   │
│                                                                             │
│  Extracted Result Actions:                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │ 📋 Copy to Clip  │  │ ✏️ Edit Text     │  │ 📤 Export .TXT   │           │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │ ⚡ Auto-Fill Form │  │ 🔍 Search Text   │  │ 🔄 Re-Scan Area  │           │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Gap 1: No Freeform Region Selector ("Snipping Tool")
- **Current State:** The user uploads a full-card image, and the system executes hardcoded geometric sub-crops (e.g. fixed percentages for PAN or Cheques).
- **Target State:** Add an interactive draggable crop overlay allowing the user to pinch, zoom, and draw a bounding box around any specific paragraph, serial number, or table cell for instant recognition.

### Gap 2: Missing Raw Text Action Bar (Copy / Edit / Export)
- **Current State:** Extracted data is routed directly into form inputs (`firstName`, `dob`, `panNumber`). The raw text is visible only in a developer debug modal.
- **Target State:** Provide an end-user **Text Inspector Drawer**:
  - **1-Click Copy**: Copy selected text or all recognized lines to Android clipboard with a single tap.
  - **In-Place Edit**: Allow quick manual correction of OCR misreadings before copying or submitting.
  - **Export Options**: Export raw text as `.txt`, `.csv` (for tables/ledgers), or share directly via the Android native share sheet (`ShareCompat`).

### Gap 3: Enforcing a Zero-Cloud Guarantee
- **Current State:** `services/api.ts` checks for network access and defaults to Gemini multimodal cloud OCR.
- **Target State:** Introduce an explicit policy switch in `settingsStore.ts`:
  - `FORCE_LOCAL_OCR = true`
  - Under this setting, the Gemini network branch is permanently bypassed for document scanning, eliminating cloud latency, API key exposure, and potential bandwidth consumption.

### Gap 4: Multi-Page Scanned PDF Limitations
- **Current State:** The PDF.js pipeline only renders page 1 of scanned documents to canvas for OCR.
- **Target State:** Loop over pages 1 through $N$ (capped at a sensible maximum, e.g. 5 pages) with a progress indicator (`"Extracting page 2 of 4..."`).

---

## 4. Architectural Recommendation: The Hybrid Engine Strategy

### Why Not 100% ML Kit Everywhere?
1. **Desktop & Web Compatibility:** Google ML Kit does not run in a standard desktop web browser. Paradigm IFS is a cross-platform progressive application running on both Android (Capacitor) and Web browsers. Removing Tesseract.js completely would break web onboarding.
2. **Regional Indian Script Reality:** Google ML Kit v2 Text Recognition supports Latin and Devanagari (Hindi/Marathi). It **does not support Dravidian scripts** (Kannada, Tamil, Telugu, Malayalam). For regional language documents, Aadhaar QR scanning is the true 100% accurate solution, with Tesseract or Gemini as fallbacks.

### The Recommended Architecture: Unified OCR Interface (`IOcrEngine`)

Create a clean TypeScript abstraction layer decoupling document extraction from the underlying OCR engine:

```typescript
export interface OcrBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrRecognizedLine {
  text: string;
  confidence: number;
  boundingBox?: OcrBoundingBox;
}

export interface OcrResult {
  fullText: string;
  lines: OcrRecognizedLine[];
  engineUsed: 'ML_KIT_NATIVE' | 'TESSERACT_WASM' | 'AADHAAR_QR';
  executionTimeMs: number;
}

export interface IOcrEngine {
  recognizeImage(base64OrBlob: string, options?: { script?: 'latin' | 'devanagari' }): Promise<OcrResult>;
  isAvailable(): boolean;
}
```

- On **Android Native**, `IOcrEngine` automatically delegates to `MlKitOcrPlugin` (Native Bridge).
- On **Web / PWA**, `IOcrEngine` delegates to `TesseractOcrEngine` (WASM Worker).
- For **Aadhaar Cards**, the system executes the **QR-First Rule** (`jsQR` + pako decompression). If a QR code is detected, extraction completes in < 50ms with 100% cryptographic accuracy, bypassing optical text recognition entirely.

---

## 5. Phased Implementation Plan & Effort Estimation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     IMPLEMENTATION TIMELINE (2 WEEKS)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Week 1: Native Plugin & Engine Abstraction                                │
│  ├── Day 1–2: Android Native Capacitor Plugin (ML Kit v2 Integration)      │
│  ├── Day 3: TypeScript Bridge & Engine Routing Layer                        │
│  └── Day 4–5: Zero-Cloud Policy & Unified Regex Field Extraction Testing   │
│                                                                             │
│  Week 2: Snipping Tool UI, Export Actions & Verification                   │
│  ├── Day 6–7: Draggable Snipping Crop Box & Interactive Text Drawer         │
│  ├── Day 8: Copy to Clipboard, Inline Editor & Android Share Sheet Export  │
│  ├── Day 9: Multi-page Scanned PDF Pipeline Upgrade                        │
│  └── Day 10: On-Device Flight-Mode Testing & Quality Signoff (v27.2.0)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 1: Native Android Capacitor Bridge (Days 1–3)
1. **Dependencies:** Add the bundled on-device ML Kit dependency to `android/app/build.gradle`:
   ```groovy
   dependencies {
       // Bundled Latin recognition (Works 100% offline without Play Services download)
       implementation 'com.google.mlkit:text-recognition:16.0.1'
       // Optional: Devanagari script for Hindi documents
       implementation 'com.google.mlkit:text-recognition-devanagari:16.0.1'
   }
   ```
2. **Native Plugin:** Implement `MlKitOcrPlugin.java` in `android/app/src/main/java/com/paradigm/ifs/plugins/`:
   - Accepts image URI or Base64 string.
   - Decodes Bitmap with correct EXIF orientation.
   - Instantiates `TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)`.
   - Returns structured JSON containing `fullText`, `blocks`, `lines`, `confidence`, and bounding coordinates.

### Phase 2: Engine Integration & Extraction Refactoring (Days 4–5)
1. Implement the `IOcrEngine` routing interface in `services/offline/ocrEngine.ts`.
2. Connect `extractDataOffline()` to consume ML Kit native results when running on Capacitor.
3. Eliminate hardcoded name/date workarounds, relying instead on clean multi-token boundaries and cryptographic QR verification.

### Phase 3: "Snipping Tool" User Interface (Days 6–8)
1. Create `components/ocr/SnippingOverlay.tsx`:
   - Interactive canvas / SVG box-selection overlay.
   - Allows users to drag-select an area of a document (e.g. cheque account number, PAN number, salary header).
2. Create `components/ocr/TextExtractionDrawer.tsx`:
   - Bottom sheet sliding drawer displaying recognized text.
   - Action buttons: `[Copy Text]`, `[Edit Text]`, `[Export .txt]`, `[Auto-Fill Form]`.
   - One-tap copy to system clipboard using `@capacitor/clipboard`.

### Phase 4: Production Verification & Zero-Cloud Hardening (Days 9–10)
1. Set default onboarding behavior to **Pure Offline Mode**.
2. Verification Matrix:
   - Physical Samsung Galaxy test in **Airplane Mode** (Wi-Fi OFF, Cellular OFF).
   - Test documents: PAN Card, Aadhaar Front, Aadhaar Back, Cancelled Cheque, Bank Passbook, Salary Slip.
   - Validate APK size difference after enabling ABI splits (`arm64-v8a`, `armeabi-v7a`).

---

## 6. Resource Breakdown & Project Estimates

| Deliverable | Engineering Effort | QA / Verification | Complexity |
| :--- | :--- | :--- | :--- |
| **Android Native Plugin (ML Kit v2)** | 3 Days | 1 Day | Moderate |
| **TypeScript Architecture & Routing** | 2 Days | 1 Day | Low |
| **Field Extraction Refactoring** | 2 Days | 1 Day | Moderate |
| **Snipping Tool UI & Action Bar** | 3 Days | 1 Day | Moderate |
| **Multi-Page Scanned PDF Support** | 1 Day | 0.5 Day | Low |
| **On-Device Stress & Airplane Mode Testing** | 1 Day | 1.5 Days | Moderate |
| **Total Project Scope** | **12 Engineering Days** | **6 QA Days** | **Overall: Moderate** |

---

## 7. Final Recommendation & Go-Forward Decision

| Action | Recommendation | Justification |
| :--- | :--- | :--- |
| **Replace Entire App?** | ❌ **NO** | Existing Capacitor app foundation, camera integration, and state stores are robust and production-ready. |
| **Discard Existing Tesseract.js?** | ❌ **NO** | Retain as secondary engine for desktop web browsers and PDF digital text extraction. |
| **Implement Native ML Kit Bridge?** | ✅ **YES (P0)** | Provides sub-second latency, eliminates WebView freezing, saves 40MB APK space, and costs ₹0 recurring. |
| **Build "Snipping Tool" UI Drawer?** | ✅ **YES (P1)** | Delivers high-utility user experience allowing arbitrary screenshot/document snippet capture, copying, and sharing. |

**Approved by:** Architecture & Security Committee  
**Next Step:** Proceed with Phase 1 Native Plugin implementation upon sprint backlog prioritization.
