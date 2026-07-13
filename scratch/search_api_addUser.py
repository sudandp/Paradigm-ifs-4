with open("pages/forms/AddUserPage.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "settings" in line.lower() or "api." in line.lower():
        print(f"L{i+1}: {line.strip()}")
