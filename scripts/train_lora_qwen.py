#!/usr/bin/env python3
"""
Paradigm Assist — Qwen 2.5 1.5B LoRA Fine-Tuning Script
Uses Unsloth (or Hugging Face SFTTrainer) to fine-tune Qwen2.5-1.5B-Instruct on
Paradigm's proprietary training dataset and export 4-bit GGUF / MLC weights.

Requirements:
    pip install unsloth "xformers<0.0.29" "trl<0.9.0" peft accelerate bitsandbytes
"""

import os
import torch

try:
    from unsloth import FastLanguageModel
    from unsloth.chat_templates import get_chat_template
    from trl import SFTTrainer
    from transformers import TrainingArguments
    from datasets import load_dataset
except ImportError:
    print("[ERROR] Unsloth / TRL not installed.")
    print("Run: pip install unsloth \"xformers<0.0.29\" \"trl<0.9.0\" peft accelerate bitsandbytes")
    exit(1)

# Configuration
MAX_SEQ_LENGTH = 2048
BASE_MODEL_NAME = "unsloth/Qwen2.5-1.5B-Instruct"
DATASET_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "training_dataset.jsonl")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "models", "paradigm_qwen_1.5b_lora")

def train():
    print(f"[INFO] Loading base model: {BASE_MODEL_NAME} with 4-bit quantization...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name = BASE_MODEL_NAME,
        max_seq_length = MAX_SEQ_LENGTH,
        dtype = None,
        load_in_4bit = True,
    )

    # Configure LoRA adapters
    print("[INFO] Adding LoRA adapters (Rank 16, Alpha 32)...")
    model = FastLanguageModel.get_peft_model(
        model,
        r = 16,
        target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha = 32,
        lora_dropout = 0,
        bias = "none",
        use_gradient_checkpointing = "unsloth",
        random_state = 3407,
    )

    # Format dataset using ChatML template
    tokenizer = get_chat_template(
        tokenizer,
        chat_template = "chatml",
        mapping = {"role": "role", "content": "content", "user": "user", "assistant": "assistant"}
    )

    def formatting_prompts_func(examples):
        convos = examples["messages"]
        texts = [tokenizer.apply_chat_template(convo, tokenize=False, add_generation_prompt=False) for convo in convos]
        return {"text": texts}

    print(f"[INFO] Loading training dataset from: {DATASET_PATH}")
    dataset = load_dataset("json", data_files=DATASET_PATH, split="train")
    dataset = dataset.map(formatting_prompts_func, batched=True)

    # Setup SFT Trainer
    trainer = SFTTrainer(
        model = model,
        tokenizer = tokenizer,
        train_dataset = dataset,
        dataset_text_field = "text",
        max_seq_length = MAX_SEQ_LENGTH,
        dataset_num_proc = 2,
        packing = False,
        args = TrainingArguments(
            per_device_train_batch_size = 2,
            gradient_accumulation_steps = 4,
            warmup_steps = 10,
            max_steps = 120,
            learning_rate = 2e-4,
            fp16 = not torch.cuda.is_bf16_supported(),
            bf16 = torch.cuda.is_bf16_supported(),
            logging_steps = 10,
            optim = "adamw_8bit",
            weight_decay = 0.01,
            lr_scheduler_type = "cosine",
            seed = 3407,
            output_dir = OUTPUT_DIR,
            report_to = "none"
        ),
    )

    print("[INFO] Starting LoRA Fine-Tuning...")
    trainer.train()

    print(f"[SUCCESS] Model training complete! Saving LoRA weights to {OUTPUT_DIR}")
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)

    # Export to 4-bit GGUF for Android APK bundling
    gguf_output_dir = os.path.join(os.path.dirname(__file__), "..", "models", "paradigm_qwen_1.5b_q4_k_m")
    print(f"[INFO] Exporting to GGUF format: {gguf_output_dir}...")
    try:
        model.save_pretrained_gguf(gguf_output_dir, tokenizer, quantization_method="q4_k_m")
        print(f"[SUCCESS] GGUF model exported for Android APK bundling at: {gguf_output_dir}")
    except Exception as e:
        print(f"[NOTE] GGUF export requires llama.cpp installed. Manual export instructions in README. Error: {e}")

if __name__ == "__main__":
    train()
