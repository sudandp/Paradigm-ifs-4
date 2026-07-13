import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

workspace_dir = r"e:\backup\onboarding all files\Paradigm Office 4"
pattern = re.compile(r'setCustomValidity|reportValidity', re.IGNORECASE)

for root, dirs, files in os.walk(workspace_dir):
    if "node_modules" in root or ".git" in root or "dist" in root or "dist_old" in root:
        continue
    for file in files:
        if file.endswith(".tsx") or file.endswith(".ts") or file.endswith(".js"):
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                if pattern.search(content):
                    print(f"{os.path.relpath(file_path, workspace_dir)} matches.")
            except Exception as e:
                pass
