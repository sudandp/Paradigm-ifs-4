import re

file_path = r'e:\backup\onboarding all files\Paradigm Office 4\pages\leaves\ApplyLeave.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all occurrences of hidden md:block in the Adjusted In/Out context
content = content.replace(
    '''<div className={`hidden md:block font-bold ${isMobile ? 'opacity-40' : 'text-gray-300'}`}>➔</div>''',
    '''<div className={`font-bold ${isMobile ? 'opacity-40' : 'text-gray-300'}`}>➔</div>'''
)

content = content.replace(
    '''<div className={`hidden md:block font-bold ${isMobile ? 'opacity-40' : 'text-gray-300'}`}>|</div>''',
    '''<div className={`font-bold ${isMobile ? 'opacity-40' : 'text-gray-300'}`}>|</div>'''
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated dividers to show on mobile")
