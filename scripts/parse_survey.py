import json

with open('survey_results.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("="*60)
print("1. CRITICAL: BOTTOM COLLISION (Android 3-Button / iOS Home Bar)")
print("="*60)
for it in data['CAT_B_BOTTOM_COLLISION']:
    print(f"- {it['file']}:{it['line']}")
    print(f"  Snippet: {it['snippet']}")

print("\n" + "="*60)
print("2. CRITICAL: TOP COLLISION (Status Bar / Camera Punch Hole)")
print("="*60)
for it in data['CAT_C_TOP_COLLISION'][:15]:
    print(f"- {it['file']}:{it['line']}")
    print(f"  Snippet: {it['snippet']}")

print("\n" + "="*60)
print("3. HIGH: MODALS WITHOUT PORTAL (Trapped in CSS transform/overflow)")
print("="*60)
for it in data['CAT_A_NO_PORTAL'][:15]:
    print(f"- {it['file']}:{it['line']}")
    print(f"  Snippet: {it['snippet']}")
