transcript_path = r"C:\Users\sudhan\.gemini\antigravity-ide\brain\e9557e25-bd80-44b7-b34e-483262d7ff07\.system_generated\logs\transcript.jsonl"

with open(transcript_path, "r", encoding="utf-8") as f:
    for line in f:
        if "dateInputs.map" in line:
            print(line[:2000])
            print("="*100)
