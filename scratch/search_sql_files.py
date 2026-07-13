import os

workspace_dir = r"e:\backup\onboarding all files\Paradigm Office 4"
for root, dirs, files in os.walk(workspace_dir):
    if "node_modules" in root or ".git" in root:
        continue
    for file in files:
        if file.endswith(".sql"):
            print(os.path.join(root, file))
