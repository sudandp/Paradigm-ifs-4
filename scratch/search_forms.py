with open("pages/forms/AddUserPage.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "<form" in line:
        print(f"L{i+1}: {line.strip()}")
