with open(r'e:\backup\onboarding all files\Paradigm Office 4\sql\sync_all_serene_departments_sep2026.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines, 1):
    for c in ['32081', '32086', '31109']:
        if f"'{c}'" in l and '2026-09-01' in l:
            print(f"Line {i} for {c}: {l.strip()[:100]}")
