import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

workspace_dir = r"e:\backup\onboarding all files\Paradigm Office 4"
pattern = re.compile(r'\.test\(', re.IGNORECASE)

include_dirs = ["pages", "components", "utils", "store", "services", "hooks", "types", "src"]

for folder in include_dirs:
    folder_path = os.path.join(workspace_dir, folder)
    if not os.path.exists(folder_path):
        continue
    for root, dirs, files in os.walk(folder_path):
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
