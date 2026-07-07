import re

file_path = r'e:\backup\onboarding all files\Paradigm Office 4\pages\leaves\ApplyLeave.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the escaped quotes and ticks that were injected
content = content.replace(r"\'", "'")
content = content.replace(r"\`", "`")
content = content.replace(r"\${", "${")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed backslashes")
