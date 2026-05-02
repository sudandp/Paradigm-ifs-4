
import sys

def find_mismatch(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        stack = []
        for line_num, line in enumerate(f, 1):
            for char in line:
                if char == '{':
                    stack.append(line_num)
                elif char == '}':
                    if not stack:
                        print(f"Extra '}}' found at line {line_num}")
                        return
                    stack.pop()
        
        if stack:
            print(f"Unclosed '{{' opened at line(s): {stack}")
        else:
            print("Braces are balanced")

if __name__ == "__main__":
    find_mismatch(sys.argv[1])
