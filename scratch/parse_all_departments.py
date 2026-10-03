import openpyxl

excel_path = r"C:\Users\sudhan\Downloads\Staff Attendance of Serene@BCU - Version_5.7- September 2026 (1).xlsm"
wb = openpyxl.load_workbook(excel_path, data_only=True)

# 1. Guide Lines
if "Guide Lines" in wb.sheetnames:
    ws = wb["Guide Lines"]
    print("=== GUIDE LINES ===")
    for row in ws.iter_rows(max_row=30, values_only=True):
        non_empty = [str(c).strip() for c in row if c is not None and str(c).strip() != '']
        if non_empty:
            print(" | ".join(non_empty))
    print()

# 2. Inspect structure of each department sheet
dept_sheets = ["Admin", "Electro Mechanical", "HK Services", "Landscaping", "Security"]

for sheet in dept_sheets:
    if sheet not in wb.sheetnames:
        continue
    ws = wb[sheet]
    print(f"=== SHEET: {sheet} ===")
    
    # Print first 10 rows to understand headers and layout
    rows = list(ws.iter_rows(max_row=12, values_only=True))
    for r_idx, r in enumerate(rows):
        cells = [str(c).strip() if c is not None else "" for c in r[:40]]
        # find non-empty
        if any(cells):
            print(f"Row {r_idx+1}: {cells[:15]}")
    
    # Count rows / employees
    emp_count = 0
    sample_emps = []
    for r in ws.iter_rows(min_row=5, max_row=100, values_only=True):
        if not r or not any(r):
            continue
        # Look for code or name
        c0 = str(r[0]).strip() if r[0] is not None else ""
        c1 = str(r[1]).strip() if len(r) > 1 and r[1] is not None else ""
        c2 = str(r[2]).strip() if len(r) > 2 and r[2] is not None else ""
        c3 = str(r[3]).strip() if len(r) > 3 and r[3] is not None else ""
        
        # Check if row looks like an employee
        if any(char.isdigit() for char in (c0 + c1 + c2)) and (c1 or c2 or c3):
            emp_count += 1
            if len(sample_emps) < 5:
                sample_emps.append((c0, c1, c2, c3))
    
    print(f"Estimated employees: {emp_count}")
    print(f"Sample employee rows: {sample_emps}")
    print()

wb.close()
