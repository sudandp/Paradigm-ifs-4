with open(r'e:\backup\onboarding all files\Paradigm Office 4\sql\sync_all_serene_departments_sep2026.sql', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if "'31056'" in line and any(f"2026-09-0{d}" in line for d in range(1, 6)):
            print(f"Line {i}: {line.strip()}")
