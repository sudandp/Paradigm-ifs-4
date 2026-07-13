import json

transcript_path = r"C:\Users\sudhan\.gemini\antigravity-ide\brain\e9557e25-bd80-44b7-b34e-483262d7ff07\.system_generated\logs\transcript.jsonl"

with open(transcript_path, "r", encoding="utf-8") as f:
    for line in f:
        if "Inspect inputs" in line or "Check min/max props" in line:
            data = json.loads(line)
            print("STEP:", data.get("step_index"))
            # Print the tool result if available
            print(data.get("content"))
            print("="*50)
