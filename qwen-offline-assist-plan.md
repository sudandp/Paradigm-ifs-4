# Implementation Plan: On-Device Qwen 2.5 1.5B Integration for Paradigm Assist

## Executive Summary
This plan details the integration of **Qwen 2.5 1.5B** running client-side (via **WebLLM / WebGPU** in browser and native on mobile) into the **Paradigm Assist 4.0 AI Copilot** (`pages/assist/ParadigmAssistPage.tsx` and `store/assistStore.ts`). 

The goal is to provide a **100% private, zero-latency, offline-capable assistant** that answers SOPs, emergency procedures, and operational queries directly on the employee's device when internet access is unavailable on-site.

---

## 1. Architectural Strategy: Hybrid Dual-Engine Copilot

```
                            ┌───────────────────────────────────┐
                            │    User Query in Paradigm Assist  │
                            └───────────────────────────────────┘
                                              │
                     ┌────────────────────────┴────────────────────────┐
                     ▼                                                 ▼
          [ Online / Cloud Mode ]                            [ Offline / On-Device Mode ]
                     │                                                 │
                     ▼                                                 ▼
         /api/paradigm-assist                              WebLLM Engine (WebGPU)
      (Serverless Cloud Backend)                         Model: Qwen2.5-1.5B-Instruct
     • Live Supabase DB sync                            • Local IndexedDB Cached Weights
     • Enterprise RAG search                            • Local Offline SOP Vector/BM25 Cache
     • Full Multi-Site Rosters                          • Zero network reliance
```

---

## 2. Phase Breakdown & Execution Status

- [x] **Phase 1: WebLLM Runtime & Core Service Setup**
  - Added `@mlc-ai/web-llm` dependency.
  - Implemented `services/offlineAiService.ts` with WebGPU detection, `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` initialization, persistent storage lock (`navigator.storage.persist()`), and streaming inference.

- [x] **Phase 2: Offline SOP & Emergency Context Grounding (Zero-Hallucination)**
  - Implemented `services/offlineKnowledgeBase.ts` with local ISO 9001:2015 manuals (DG Cold Start, STP Aeration, Lift Entrapment, Fire & Gas, Shift Rules).
  - Added keyword/token matching and prompt grounding context builder.
  - Added online background sync with Supabase `assist_sops`.

- [x] **Phase 3: Store & State Management Update (`store/assistStore.ts`)**
  - Added offline Qwen state (`isOfflineModelReady`, `isModelDownloading`, `modelDownloadProgress`, `modelStatusText`).
  - Implemented `downloadOfflineModel()` and `clearOfflineCache()`.
  - Implemented **Auto-Hybrid routing**: executes live cloud API when online, and seamlessly switches to local on-device Qwen 2.5 when offline or on server timeout.

- [x] **Phase 4: UI / UX Enhancements (`pages/assist/ParadigmAssistPage.tsx`)**
  - Added *"Offline Brain"* top bar status button with reactive states (Ready / Downloading / Idle).
  - Built `components/assist/OfflineBrainModal.tsx` for one-time on-demand download and cache clearing.
  - Added `⚡ On-Device Qwen (Offline)` badge on generated message bubbles.

- [x] **Phase 5: Verification & Quality Assurance**
  - Ran `npx tsc --noEmit` — 0 errors.
  - Browser subagent verified navigation, button appearance, modal rendering, WebGPU detection, and smooth dismissal.

---

## 3. Approved Architecture & Confirmed Decisions

Based on user configuration, the integration follows this exact specification:

1. **Download Trigger**: **On-Demand**.
   - Added a dedicated *"Download Offline Brain"* pill button in the top navigation bar of Paradigm Assist.
   - Clicking opens an interactive setup modal showing download size, WebGPU compatibility, and download progress (0%–100%) with a progress bar and status text.
   - Once downloaded, the button turns into a green indicator: *"⚡ Offline Brain Ready"*.

2. **Engine Switching**: **Auto Hybrid**.
   - Default: When online, queries proceed via `/api/paradigm-assist` for live Supabase RAG and database checks.
   - Offline / Network Failure: If `navigator.onLine === false` or the server fails, queries seamlessly redirect to the local Qwen engine without error alerts.
   - Response Badge: Offline responses display an icon badge: *"⚡ Generated on-device by Qwen (Offline Mode)"*.

3. **Hardware Adaptation**: **Adaptive Model Sizing**.
   - Standard devices (WebGPU supported & ≥ 4GB RAM): Loads `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` (~1.1 GB).
   - Low-end devices / No WebGPU / Mobile budget phones: Automatically falls back to `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` (~350 MB) for CPU/Wasm execution.

---

## 4. Edge-Case Safeguards

1. **Persistent Cache Protection**:
   - Call `navigator.storage.persist()` to request permanent storage so browsers (Chrome/Edge/Android WebView) do not evict the 1.1 GB model when disk space is tight.
   - Provide a *"Manage Storage / Clear Cache"* option inside Admin Suite / Assist Settings.

2. **Offline Knowledge Sync**:
   - Cache essential SOPs (DG Cold Start, STP, Lift Rescue, Shift Rules) in IndexedDB.
   - Whenever the app is online, run a lightweight background check against Supabase `assist_knowledge_base` to refresh stale SOP text in the local cache.

