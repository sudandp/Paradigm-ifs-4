import re

def check_jsx_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove comments
    content = re.sub(r'{\/\*.*?\*\/}', '', content, flags=re.DOTALL)
    content = re.sub(r'\/\/.*', '', content)
    
    # Simple tag extractor (handles basic JSX tags)
    tags = re.findall(r'<([a-zA-Z0-9\.]+)|<\/([a-zA-Z0-9\.]+)>', content)
    
    stack = []
    line_numbers = content.split('\n')
    
    # We'll also track braces {} and parentheses ()
    braces = 0
    parens = 0
    
    for i, line in enumerate(line_numbers):
        # This is a very crude parser but might catch obvious mismatches
        for open_tag, close_tag in re.findall(r'<([a-zA-Z0-9\.]+)(?:[^>]*[^/])?>|<\/([a-zA-Z0-9\.]+)>', line):
            if open_tag:
                if open_tag in ['img', 'input', 'br', 'hr']: continue # Skip self-closing void tags
                stack.append((open_tag, i + 1))
            elif close_tag:
                if not stack:
                    print(f"Error: Stray closing tag </{close_tag}> at line {i + 1}")
                else:
                    last_tag, last_line = stack.pop()
                    if last_tag != close_tag:
                        print(f"Error: Mismatched tag </{close_tag}> at line {i + 1} (expected </{last_tag}> from line {last_line})")
        
        braces += line.count('{') - line.count('}')
        parens += line.count('(') - line.count(')')
        
    if stack:
        for tag, line in stack:
            print(f"Error: Unclosed tag <{tag}> from line {line}")
    
    if braces != 0:
        print(f"Error: Unbalanced braces: {braces}")
    if parens != 0:
        print(f"Error: Unbalanced parentheses: {parens}")

if __name__ == "__main__":
    check_jsx_balance(r'e:\backup\onboarding all files\Paradigm Office 4\pages\gate\RegisterGateUser.tsx')
