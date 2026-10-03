with open('scratch/fix_script.py', 'w') as f:
    f.write('''
# Let's inspect the exact join logic needed.
# For each employee code in serene_all_staff.json:
# e.EmployeeCode = m.EmployeeCode
# If m.EmployeeCode has a suffix like '31109-HK', e.EmployeeCode = '31109' or match on exact name
''')
