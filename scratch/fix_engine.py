import re

path = r'e:\backup\onboarding all files\Paradigm Office 4\utils\excelTemplateEngine.ts'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The new downloadTemplate function ends with "};\n" at line ~268.
# After that, there's a junk block of orphaned code followed by another getCellValue JSDoc.
# Strategy: find the SECOND occurrence of "* Extract the plain value from an ExcelJS cell."
# and delete everything between the first occurrence (inclusive) and the second (exclusive).

marker = '/**\n * Extract the plain value from an ExcelJS cell.\n */'

first = content.find(marker)
second = content.find(marker, first + 1)

if first == -1 or second == -1:
    print(f"Markers found: first={first}, second={second}")
    print("Could not find both markers, aborting")
else:
    # Replace from first occurrence to second occurrence (keep second)
    new_content = content[:first] + content[second:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    # Verify
    lines = new_content.split('\n')
    print(f"Done. New total lines: {len(lines)}")
    
    # Show context around where the seam is now
    idx = new_content.find(marker)
    line_num = new_content[:idx].count('\n') + 1
    print(f"JSDoc now at line: {line_num}")
    snippet_lines = lines[line_num-3:line_num+5]
    for i, l in enumerate(snippet_lines, start=line_num-2):
        print(f"{i}: {l}")
