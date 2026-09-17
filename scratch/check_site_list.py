import json, re, urllib.request
from dotenv import dotenv_values

with open('scratch/parsed_deployment.json') as f:
    excel_sites = json.load(f)

# Let's inspect what site names might be in departmentList
# Let's check the attendance records or employees from supabase or mssql
config = dotenv_values('.env.local')
url = config.get('VITE_SUPABASE_URL')
key = config.get('SUPABASE_SERVICE_ROLE_KEY') or config.get('VITE_SUPABASE_SERVICE_ROLE_KEY') or config.get('VITE_SUPABASE_ANON_KEY')

req = urllib.request.Request(f'{url}/rest/v1/organizations?select=id,short_name,full_name,manpower_approved_count', headers={
    'apikey': key,
    'Authorization': f'Bearer {key}'
})

with urllib.request.urlopen(req) as resp:
    db_orgs = json.loads(resp.read().decode('utf-8'))

print('Total excel sites:', len(excel_sites))
"
