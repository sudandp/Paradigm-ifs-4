import sys

# Set stdout to use utf-8 to prevent console print errors
sys.stdout.reconfigure(encoding='utf-8')

with open("pages/forms/AddUserPage.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    l_lower = line.lower()
    if "min" in l_lower or "date" in l_lower or "sub" in l_lower:
        print(f"L{i+1}: {line.strip()}")
