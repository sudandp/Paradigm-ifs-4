import openpyxl
import os

excel_path = r"C:\Users\sudhan\Downloads\Staff Attendance of Serene@BCU - Version_5.7- September 2026 (1).xlsm"

if not os.path.exists(excel_path):
    print(f"File not found: {excel_path}")
    exit(1)

wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
print("Sheet names in workbook:")
for idx, sheetname in enumerate(wb.sheetnames):
    print(f"  [{idx}] {sheetname}")

wb.close()
