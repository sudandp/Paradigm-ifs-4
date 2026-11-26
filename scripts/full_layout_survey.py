import os
import re
import json

results = {
    'CAT_A_NO_PORTAL': [],
    'CAT_B_BOTTOM_COLLISION': [],
    'CAT_C_TOP_COLLISION': [],
    'CAT_D_MODAL_UNBOUNDED_HEIGHT': [],
}

def analyze_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    except Exception:
        return

    content = ''.join(lines)
    filename = os.path.basename(filepath)
    is_modal_or_drawer = any(k in filename.lower() for k in ['modal', 'drawer', 'sheet', 'dialog', 'popup', 'alert', 'picker']) or \
                         ('role="dialog"' in content or 'aria-modal' in content)
    has_portal = 'createPortal' in content
    
    for i, line in enumerate(lines):
        line_num = i + 1
        
        # Category A: Modal / Drawer with fixed inset-0 without portal
        if is_modal_or_drawer and ('fixed inset-0' in line or ('fixed ' in line and 'inset-0' in line)):
            if not has_portal:
                results['CAT_A_NO_PORTAL'].append({
                    'file': filepath,
                    'line': line_num,
                    'snippet': line.strip()[:90],
                    'issue': 'Modal uses fixed inset-0 without createPortal (risk of transform-parent trapping)'
                })
        
        # Category B: Bottom sheet / bottom modal collision
        if ('items-end' in line and ('fixed' in line or 'absolute' in line)) or \
           ('fixed ' in line and 'bottom-0' in line) or \
           (is_modal_or_drawer and 'items-end' in line):
            surrounding = ''.join(lines[max(0, i-2):min(len(lines), i+8)])
            has_safe_padding = any(s in surrounding for s in [
                'safe-area-inset-bottom', '--pb-safe', 'pb-safe', 'paddingBottom'
            ])
            if not has_safe_padding:
                results['CAT_B_BOTTOM_COLLISION'].append({
                    'file': filepath,
                    'line': line_num,
                    'snippet': line.strip()[:90],
                    'issue': 'Bottom-aligned sheet/bar lacks safe-area-inset-bottom padding (collides with 3-button nav / home bar)'
                })
        
        # Category C: Fixed top banner / bar without safe area top
        if ('fixed ' in line and 'top-0' in line) or ('sticky ' in line and 'top-0' in line):
            if not is_modal_or_drawer: # full-page modals can have internal headers
                surrounding = ''.join(lines[max(0, i-2):min(len(lines), i+8)])
                has_safe_top = any(s in surrounding for s in [
                    'safe-area-inset-top', '--pt-safe', 'pt-safe', 'paddingTop'
                ])
                if not has_safe_top:
                    results['CAT_C_TOP_COLLISION'].append({
                        'file': filepath,
                        'line': line_num,
                        'snippet': line.strip()[:90],
                        'issue': 'Fixed/sticky top bar lacks safe-area-inset-top (collides with status bar / camera notch)'
                    })

        # Category D: Modal without max-height or overflow-y-auto
        if is_modal_or_drawer and ('fixed inset-0' in line or 'fixed ' in line and 'inset-0' in line):
            surrounding = ''.join(lines[i:min(len(lines), i+25)])
            has_scroll = 'overflow-y-auto' in surrounding or 'overflow-auto' in surrounding
            has_max_h = 'max-h-' in surrounding or 'maxHeight' in surrounding or 'h-full' in surrounding or 'h-screen' in surrounding
            if not has_scroll or not has_max_h:
                results['CAT_D_MODAL_UNBOUNDED_HEIGHT'].append({
                    'file': filepath,
                    'line': line_num,
                    'snippet': line.strip()[:90],
                    'issue': 'Modal container may lack max-h-[] or overflow-y-auto (risk of action buttons clipped on small screens)'
                })

for root_dir in ['components', 'pages']:
    for root, dirs, files in os.walk(root_dir):
        for f in files:
            if f.endswith(('.tsx', '.jsx')) and not f.endswith('.test.tsx'):
                analyze_file(os.path.join(root, f))

with open('survey_results.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2)

print("Scan complete. Summary:")
for cat, items in results.items():
    print(f"{cat}: {len(items)} issues found")
