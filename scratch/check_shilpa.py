import urllib.request, json, os, sys

url = "https://fmyafuhxlorbafbacywa.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M"

print('Connecting to:', url, flush=True)

try:
    req = urllib.request.Request(f"{url}/rest/v1/users?name=ilike.*Shilpa*&select=id,name,email", headers={
        'apikey': key,
        'Authorization': f'Bearer {key}'
    })
    with urllib.request.urlopen(req, timeout=10) as resp:
        users = json.loads(resp.read().decode('utf-8'))
    print('Users found:', users, flush=True)

    for u in users:
        uid = u['id']
        req2 = urllib.request.Request(f"{url}/rest/v1/leave_requests?user_id=eq.{uid}&select=id,leave_type,status,start_date,end_date,created_at&order=created_at.desc", headers={
            'apikey': key,
            'Authorization': f'Bearer {key}'
        })
        with urllib.request.urlopen(req2, timeout=10) as resp2:
            leaves = json.loads(resp2.read().decode('utf-8'))
        print(f"Leave requests for {u['name']} ({len(leaves)} total):", flush=True)
        for l in leaves:
            print('  ', l, flush=True)
except Exception as e:
    print('Error:', e, flush=True)
