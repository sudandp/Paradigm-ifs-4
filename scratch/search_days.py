import os
import re

workspace_dir = r"e:\backup\onboarding all files\Paradigm Office 4"
# Search for occurrences of '20' or 'days' or subDays/differenceInDays in the source code
pattern = re.compile(r'\b20\b|subDays|differenceInDays|setDate|setMonth', re.IGNORECASE)

for root, dirs, files in os.walk(workspace_dir):
    if "node_modules" in root or ".git" in root or "dist" in root or "dist_old" in root:
        continue
    for file in files:
        if file.endswith(".tsx") or file.endswith(".ts"):
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                for i, line in enumerate(lines):
                    if pattern.search(line):
                        print(f"{os.path.relpath(file_path, workspace_dir)}: L{i+1}: {line.strip()}")
            except Exception as e:
                pass
