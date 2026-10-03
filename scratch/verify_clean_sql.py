with open(r'e:\backup\onboarding all files\Paradigm Office 4\sql\sync_all_serene_departments_sep2026.sql', 'r', encoding='utf-8') as f:
    content = f.read()

errors = []
if 'ScheduleDate' in content: errors.append('ScheduleDate found!')
if 'ShiftGroupName' in content: errors.append('ShiftGroupName found!')
if 'TRY_CONVERT' in content: errors.append('TRY_CONVERT found!')
if 'DISABLE TRIGGER ALL ON' in content: errors.append('DISABLE TRIGGER ALL ON found!')
if 'ENABLE TRIGGER ALL ON' in content: errors.append('ENABLE TRIGGER ALL ON found!')

print("Errors found:", errors)
print("File length:", len(content))
