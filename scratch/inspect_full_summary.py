import openpyxl

excel_path = r"C:\Users\sudhan\Downloads\Staff Attendance of Serene@BCU - Version_5.7- September 2026 (1).xlsm"
wb = openpyxl.load_workbook(excel_path, data_only=True)

ws = wb["Summary"]
print("=== SUMMARY SHEET FULL CONTENT ===")
for r_idx, row in enumerate(ws.iter_rows(max_row=45, values_only=True)):
    cells = [str(c).strip() if c is not None else "" for c in row[:20]]
    if any(cells):
        print(f"L{r_idx+1}: " + " | ".join(cells))

wb.close()
