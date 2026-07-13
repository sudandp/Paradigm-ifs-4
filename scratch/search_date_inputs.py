with open("pages/forms/AddUserPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

import re
matches = re.finditer(r'<Input[^>]*type=["\']date["\'][^>]*>', content)
for m in matches:
    start = max(0, content.rfind('\n', 0, m.start()) - 100)
    end = min(len(content), content.find('\n', m.end()) + 200)
    print(f"Match found at position {m.start()}:\n{content[start:end]}\n{'-'*50}")
