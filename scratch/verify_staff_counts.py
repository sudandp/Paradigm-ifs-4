import json

with open('scratch/serene_all_staff.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Let's inspect all staff in data
total_emps = 0
for dept, emps in data.items():
    print(f"Dept {dept}: {len(emps)} emps")
    total_emps += len(emps)
print(f"Total: {total_emps}")
