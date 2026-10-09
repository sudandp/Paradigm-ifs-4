# Paradigm Assist — Native Android Bundled Model Assets

This directory packages the 100% offline quantized **Paradigm Assist (Qwen 2.5 1.5B 4-bit)** model inside the Android APK.

### Target Files:
When fine-tuning completes via `notebooks/Paradigm_Assist_Qwen_LoRA_Training.ipynb` or `scripts/train_lora_qwen.py`:
1. `paradigm-assist-q4_k_m.gguf` (Quantized 4-bit model weights, ~920MB)
2. `tokenizer.json` (Qwen ChatML tokenizer configuration)
3. `config.json` (Model runtime parameters)

### Offline Zero-Download Loading Mechanism:
- Capacitor WebView maps `file:///android_asset/models/paradigm-assist-1.5b/` directly into native memory or IndexedDB cache.
- Technicians in underground basements, pump rooms, or remote substations have instant access to Paradigm Assist without ever needing cellular data or internet downloads.
