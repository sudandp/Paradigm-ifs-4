import re
import sys

def check_jsx_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove style blocks
    content = re.sub(r'<style>.*?</style>', '', content, flags=re.DOTALL)
    # Remove comments
    content = re.sub(r'\{/\*.*?\*/\}', '', content, flags=re.DOTALL)
    content = re.sub(r'//.*', '', content)
    # Remove strings
    content = re.sub(r'["\'].*?["\']', '', content)
    # Remove template literals
    content = re.sub(r'`.*?`', '', content, flags=re.DOTALL)
    # Remove Generic types <Type> to avoid confusion with JSX
    content = re.sub(r'<\s*[\w.\[\]]+\s*>', '', content)
    
    # Extract tags
    # Handle self-closing tags like <Tag />
    tags = re.findall(r'<(/?[\w.]+)(?:\s+[^>]*?)?\s*(/?)>', content)
    
    stack = []
    errors = []
    
    for tag, self_closing in tags:
        if self_closing == '/':
            continue
            
        if tag.startswith('/'):
            closing_tag = tag[1:]
            if not stack:
                errors.append(f"Extra closing tag: </{closing_tag}>")
            else:
                opening_tag = stack.pop()
                if opening_tag != closing_tag:
                    errors.append(f"Mismatched tags: <{opening_tag}> closed by </{closing_tag}>")
        else:
            stack.append(tag)
            
    for remaining in stack:
        errors.append(f"Unclosed tag: <{remaining}>")
        
    if not errors:
        print("All tags are balanced!")
    else:
        for err in errors:
            print(err)

if __name__ == "__main__":
    check_jsx_balance(sys.argv[1])
