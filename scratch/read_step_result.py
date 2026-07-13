transcript_path = r"C:\Users\sudhan\.gemini\antigravity-ide\brain\e9557e25-bd80-44b7-b34e-483262d7ff07\.system_generated\logs\transcript.jsonl"

with open(transcript_path, "r", encoding="utf-8") as f:
    for line in f:
        if "Check min/max props" in line and '"result"' in line:
            print(line[:1000]) # Print first 1000 chars of the match
            print("*"*100)
            # Find the actual result JSON block
            import json
            obj = json.loads(line)
            print(obj.get("content"))
