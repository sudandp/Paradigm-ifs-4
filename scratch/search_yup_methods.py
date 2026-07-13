import os
import re

workspace_dir = r"e:\backup\onboarding all files\Paradigm Office 4"
pattern = re.compile(r'yup\.(addMethod|string|date|number)\(|YupSchema', re.IGNORECASE)

for root, dirs, files in os.walk(workspace_dir):
    if "node_modules" in root or ".git" in root or "dist" in root or "dist_old" in root:
        continue
    for file in files:
        if file.endswith(".tsx") or file.endswith(".ts"):
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                if "addMethod" in content or "yup" in content.lower():
                    matches = pattern.findall(content)
                    if matches:
                        print(f"{os.path.relpath(file_path, workspace_dir)} contains yup references or addMethod: {matches}")
            except Exception as e:
                pass
