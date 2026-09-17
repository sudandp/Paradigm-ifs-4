import json, re, difflib, urllib.request
from dotenv import dotenv_values

config = dotenv_values('.env.local')
url = config.get('VITE_SUPABASE_URL')
key = config.get('SUPABASE_SERVICE_ROLE_KEY') or config.get('VITE_SUPABASE_SERVICE_ROLE_KEY') or config.get('VITE_SUPABASE_ANON_KEY')

with open('scratch/parsed_deployment.json') as f:
    excel_sites = json.load(f)

req = urllib.request.Request(f'{url}/rest/v1/organizations?select=id,short_name,full_name,manpower_approved_count', headers={
    'apikey': key,
    'Authorization': f'Bearer {key}'
})

with urllib.request.urlopen(req) as resp:
    db_orgs = json.loads(resp.read().decode('utf-8'))

def clean_key(s):
    return re.sub(r'[^a-z0-9]', '', str(s).lower())

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from test_db_sync import ALIAS_MAP, excel_clean

matched_ids = set()
matched_excel = set()

for org in db_orgs:
    s_clean = clean_key(org['short_name'])
    f_clean = clean_key(org.get('full_name') or '')
    id_clean = clean_key(org['id'])

    target_clean = ALIAS_MAP.get(s_clean) or ALIAS_MAP.get(f_clean) or ALIAS_MAP.get(id_clean)
    if not target_clean:
        if s_clean in excel_clean:
            target_clean = s_clean
        elif f_clean in excel_clean:
            target_clean = f_clean
        elif id_clean in excel_clean:
            target_clean = id_clean

    if target_clean and target_clean in excel_clean:
        matched_ids.add(org['id'])
        matched_excel.add(excel_clean[target_clean][0])

print(f"Matched DB orgs: {len(matched_ids)}")
print(f"Matched Excel sites: {len(matched_excel)}")

unmatched_excel = [k for k in excel_sites if k not in matched_excel]
unmatched_db = [o for o in db_orgs if o['id'] not in matched_ids]

print(f"Remaining Excel sites: {len(unmatched_excel)}")
print(f"Remaining DB orgs: {len(unmatched_db)}")

# Try to find fuzzy matches for remaining
print("\nSuggested matches:")
for u in unmatched_excel:
    close = difflib.get_close_matches(u.upper(), [o['short_name'].upper() for o in unmatched_db], n=1, cutoff=0.5)
    if close:
        for o in unmatched_db:
            if o['short_name'].upper() == close[0]:
                print(f"  Excel: {u:<35} -> DB: {o['short_name']} ({o['id']})")
                break
