import os
import re

findings = []

def scan_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception as e:
        return

    # Check for fixed overlay / modal patterns
    # e.g. fixed inset-0, fixed bottom-0, role="dialog"
    has_fixed_overlay = bool(re.search(r'fixed\s+inset-0|fixed\s+[^"\'`]*inset-0', content))
    has_portal = 'createPortal' in content
    has_safe_bottom = 'safe-area-inset-bottom' in content or '--pb-safe' in content or 'pb-safe' in content
    has_safe_top = 'safe-area-inset-top' in content or '--pt-safe' in content or 'pt-safe' in content
    has_items_end = 'items-end' in content and 'fixed' in content
    has_fixed_bottom = bool(re.search(r'fixed\s+[^"\'`]*bottom-0|fixed\s+bottom-0', content))

    filename_lower = os.path.basename(filepath).lower()
    is_modal_or_dialog = any(w in filename_lower for w in ['modal', 'dialog', 'sheet', 'drawer', 'popup', 'alert', 'picker']) or \
                         any(w in content.lower() for w in ['role="dialog"', 'aria-modal', 'modal', 'dialog'])

    # 1. Fixed overlay / modal without portal
    if has_fixed_overlay and is_modal_or_dialog and not has_portal:
        findings.append({
            'file': filepath,
            'issue': 'MODAL_WITHOUT_PORTAL',
            'severity': 'HIGH',
            'desc': 'Fixed modal/overlay detected without createPortal - vulnerable to CSS transform containing-block trapping'
        })

    # 2. Bottom-aligned sheet/modal without safe area bottom
    if (has_items_end or has_fixed_bottom) and is_modal_or_dialog and not has_safe_bottom:
        findings.append({
            'file': filepath,
            'issue': 'BOTTOM_MODAL_NO_SAFE_AREA',
            'severity': 'CRITICAL',
            'desc': 'Bottom-aligned sheet/modal (items-end or fixed bottom-0) without safe-area-inset-bottom padding - collides with Android 3-button nav / iOS home bar'
        })

    # 3. Fixed bottom action bar (e.g. footer buttons, bottom nav) without safe area
    if has_fixed_bottom and not is_modal_or_dialog and not has_safe_bottom:
        findings.append({
            'file': filepath,
            'issue': 'FIXED_BOTTOM_BAR_NO_SAFE_AREA',
            'severity': 'HIGH',
            'desc': 'Fixed bottom bar without safe-area-inset-bottom padding'
        })

    # 4. Fixed top bar / header without safe area top
    if bool(re.search(r'fixed\s+[^"\'`]*top-0|fixed\s+top-0', content)) and not is_modal_or_dialog and not has_safe_top:
        findings.append({
            'file': filepath,
            'issue': 'FIXED_TOP_BAR_NO_SAFE_AREA',
            'severity': 'MEDIUM',
            'desc': 'Fixed top bar without safe-area-inset-top padding'
        })

for root_dir in ['components', 'pages', 'src']:
    if os.path.exists(root_dir):
        for root, dirs, files in os.walk(root_dir):
            for file in files:
                if file.endswith(('.tsx', '.jsx')) and not file.endswith('.test.tsx'):
                    scan_file(os.path.join(root, file))

print(f"Total findings: {len(findings)}")
by_issue = {}
for f in findings:
    by_issue.setdefault(f['issue'], []).append(f)

for issue, items in by_issue.items():
    print(f"\n==========================================")
    print(f"=== {issue} ({len(items)} files) ===")
    print(f"==========================================")
    for it in items:
        print(f"[{it['severity']}] {it['file']}")
