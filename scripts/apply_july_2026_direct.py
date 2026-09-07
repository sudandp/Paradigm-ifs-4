import openpyxl
import os
import sys
import json
import urllib.request
from datetime import datetime, time, date

sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'https://fmyafuhxlorbafbacywa.supabase.co'
SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
EXCEL_PATH = r"C:\Users\sudhan\Downloads\bulk Monthly Invoice Reprt for July 2026.xlsx"

USER_MAP = {
    'sandeep': {'id': '04364421-22db-44e2-b1f1-08bcebc3d562', 'name': 'Sandeep B', 'role': 'operations'},
    'shilpa': {'id': '94a4f34e-f4d0-42d5-b2c5-7b43419a3325', 'name': 'Shilpa M', 'role': 'operations'},
    'issac': {'id': '2a637f75-8829-4572-bdbb-d60f7bb62bd6', 'name': 'Isaac Roy', 'role': 'operations'},
    'isaac': {'id': '2a637f75-8829-4572-bdbb-d60f7bb62bd6', 'name': 'Isaac Roy', 'role': 'operations'},
    'venkat': {'id': 'ed8ce87f-1f28-4a3a-a319-4dc502add40d', 'name': 'Venkatachalam', 'role': 'operations'},
    'harish': {'id': '10c74709-58d5-43d8-a8aa-9233699fc751', 'name': 'Harish H P', 'role': 'operations'},
    'murali': {'id': '63d47c04-28f5-43d4-8302-9ab990b7926a', 'name': 'Muralidhara B K', 'role': 'operations'},
    'muruli': {'id': '63d47c04-28f5-43d4-8302-9ab990b7926a', 'name': 'Muralidhara B K', 'role': 'operations'},
    'sashikanth': {'id': 'b6144e7e-d5e8-4f64-b50f-f15d01739c40', 'name': 'sashikanta das', 'role': 'operations'},
    'stany': {'id': '4f62cbdd-6410-4fa3-9d7e-04b05fc41866', 'name': 'Stany D Souza', 'role': 'operations'},
    'omkar': {'id': '8fb818f1-3750-4bd0-83ad-8832550c7fab', 'name': 'Omkar', 'role': 'operations'},
    'omkar/ stany': {'id': '8fb818f1-3750-4bd0-83ad-8832550c7fab', 'name': 'Omkar', 'role': 'operations'},
    'kannaiah': {'id': 'ffa83345-6b20-4995-af50-674790ecf906', 'name': 'Kannaiah R', 'role': 'operations'},
    'chandana': {'id': 'bbcbb70e-9c52-46c3-96e9-8e89155e35bd', 'name': 'Chandana R', 'role': 'hr'},
    'pooja': {'id': 'c96bc0e5-4b75-42a2-9f69-139de275ab7e', 'name': 'Poojashree S', 'role': 'hr'},
    'kavya': {'id': '07f61efd-24f2-457e-84b3-d8dafcb556c6', 'name': 'Kavya M', 'role': 'hr'},
    'arpitha': {'id': '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'name': 'Arpitha Nairy', 'role': 'finance'},
    'sinchana': {'id': 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'name': 'Sinchana KM', 'role': 'finance'},
    'sudhan': {'id': '34aaddf9-77a0-4e2f-984b-b745cddb4808', 'name': 'Sudhan (IOT Architect)', 'role': 'finance_manager'}
}
DEFAULT_ADMIN = USER_MAP['sudhan']

def clean_str(val):
    if val is None: return ''
    return str(val).replace('\xa0', ' ').strip()

def parse_date_str(val):
    if val is None: return None
    if isinstance(val, (datetime, date)):
        return val.strftime('%Y-%m-%d')
    s = str(val).strip()
    if not s or s.lower() == 'none': return None
    for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%Y/%m/%d', '%d-%b-%Y'):
        try:
            d = datetime.strptime(s, fmt)
            return d.strftime('%Y-%m-%d')
        except ValueError:
            pass
    return None

def parse_time_str(val):
    if val is None: return ''
    if isinstance(val, (time, datetime)):
        return val.strftime('%H:%M')
    s = str(val).strip()
    return '' if s.lower() == 'none' else s

def parse_num(val):
    if val is None: return 0.0
    try:
        s = str(val).replace(',', '').strip()
        return float(s)
    except (ValueError, TypeError):
        return 0.0

def resolve_user(name_str):
    if not name_str: return DEFAULT_ADMIN
    return USER_MAP.get(str(name_str).strip().lower(), DEFAULT_ADMIN)

def normalize_title(name_str):
    if not name_str: return ''
    user = USER_MAP.get(str(name_str).strip().lower())
    if user:
        short_names = {
            '04364421-22db-44e2-b1f1-08bcebc3d562': 'Sandeep',
            '94a4f34e-f4d0-42d5-b2c5-7b43419a3325': 'Shilpa',
            '2a637f75-8829-4572-bdbb-d60f7bb62bd6': 'Isaac',
            'ed8ce87f-1f28-4a3a-a319-4dc502add40d': 'Venkat',
            '10c74709-58d5-43d8-a8aa-9233699fc751': 'Harish',
            '63d47c04-28f5-43d4-8302-9ab990b7926a': 'Murali',
            'b6144e7e-d5e8-4f64-b50f-f15d01739c40': 'Sashikanth',
            '4f62cbdd-6410-4fa3-9d7e-04b05fc41866': 'Stany',
            '8fb818f1-3750-4bd0-83ad-8832550c7fab': 'Omkar',
            'ffa83345-6b20-4995-af50-674790ecf906': 'Kannaiah',
            'bbcbb70e-9c52-46c3-96e9-8e89155e35bd': 'Chandana',
            'c96bc0e5-4b75-42a2-9f69-139de275ab7e': 'Pooja',
            '07f61efd-24f2-457e-84b3-d8dafcb556c6': 'Kavya',
            '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27': 'Arpitha',
            'c9ffc969-8f2b-48cf-914c-0f30a661ba6f': 'Sinchana',
        }
        return short_names.get(user['id'], user['name'])
    return str(name_str).strip()

def run_direct():
    print("Reading Excel and preparing July 2026 migration records...")
    
    headers = {
        'apikey': SERVICE_KEY,
        'Authorization': f'Bearer {SERVICE_KEY}',
        'Content-Type': 'application/json'
    }
    
    req1 = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/site_invoice_tracker?select=site_name,manager_tentative_date&deleted_at=is.null&limit=3000", headers=headers)
    with urllib.request.urlopen(req1) as resp:
        existing_invoices = set(f"{r['site_name']}___{r.get('manager_tentative_date')}" for r in json.loads(resp.read().decode('utf-8')))
    print(f"Existing site_invoice_tracker records in DB: {len(existing_invoices)}")
    
    req2 = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/site_finance_tracker?select=site_name,billing_month&deleted_at=is.null&limit=3000", headers=headers)
    with urllib.request.urlopen(req2) as resp:
        existing_finances = set(f"{r['site_name']}___{r.get('billing_month')}" for r in json.loads(resp.read().decode('utf-8')))
    print(f"Existing site_finance_tracker records in DB: {len(existing_finances)}")

    wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))
    wb.close()

    data_rows = [r for i, r in enumerate(rows) if i >= 8 and r[1] and str(r[1]).strip() != '']
    print(f"Valid data rows in July 2026: {len(data_rows)}")

    new_invoices = []
    new_finances = []
    b_month = '2026-07-01'
    c_at = '2026-08-15T12:00:00+00:00'

    for r in data_rows:
        site_name = clean_str(r[1])
        comp_name = clean_str(r[2]) if r[2] else 'PIFS'
        if not comp_name: comp_name = 'PIFS'
        cycle = clean_str(r[3]) if r[3] else '3rd Billing Cycle'
        
        ops_val = clean_str(r[4])
        hr_val = clean_str(r[5])
        inv_val = clean_str(r[6])
        creator_user = resolve_user(inv_val)
        
        mgr_tentative = parse_date_str(r[7])
        
        inv_key = f"{site_name}___{mgr_tentative}"
        if inv_key not in existing_invoices:
            new_invoices.append({
                'site_name': site_name,
                'company_name': comp_name,
                'billing_cycle': cycle,
                'ops_incharge': normalize_title(ops_val),
                'hr_incharge': normalize_title(hr_val),
                'invoice_incharge': normalize_title(inv_val),
                'manager_tentative_date': mgr_tentative,
                'manager_received_date': parse_date_str(r[8]),
                'hr_tentative_date': parse_date_str(r[10]),
                'hr_received_date': parse_date_str(r[11]),
                'attendance_received_time': parse_time_str(r[12]),
                'invoice_sharing_tentative_date': parse_date_str(r[14]),
                'invoice_prepared_date': parse_date_str(r[15]),
                'invoice_sent_date': parse_date_str(r[16]),
                'invoice_sent_time': parse_time_str(r[18]),
                'invoice_sent_method_remarks': clean_str(r[27]),
                'created_by': creator_user['id'],
                'created_by_name': creator_user['name'],
                'created_by_role': creator_user['role'],
                'created_at': c_at,
                'updated_at': c_at
            })
            existing_invoices.add(inv_key)
            
        fin_key = f"{site_name}___{b_month}"
        if fin_key not in existing_finances:
            new_finances.append({
                'site_name': site_name,
                'company_name': comp_name,
                'billing_month': b_month,
                'contract_amount': parse_num(r[28]),
                'contract_management_fee': parse_num(r[30]),
                'billed_amount': parse_num(r[21]),
                'billed_management_fee': parse_num(r[22]),
                'remarks': clean_str(r[32]),
                'status': 'pending',
                'created_by': creator_user['id'],
                'created_by_name': creator_user['name'],
                'created_by_role': creator_user['role'],
                'created_at': c_at,
                'updated_at': c_at
            })
            existing_finances.add(fin_key)

    print(f"\nNew site_invoice_tracker records to insert: {len(new_invoices)}")
    print(f"New site_finance_tracker records to insert: {len(new_finances)}")

    def batch_insert(table, records, batch_size=50):
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        for i in range(0, len(records), batch_size):
            chunk = records[i:i+batch_size]
            payload = json.dumps(chunk).encode('utf-8')
            req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
            try:
                with urllib.request.urlopen(req) as resp:
                    pass
                print(f"  Inserted {table} rows {i+1} to {min(i+batch_size, len(records))}")
            except Exception as e:
                print(f"  Error inserting {table} batch: {e}")
                
    if new_invoices:
        print("\nInserting into site_invoice_tracker...")
        batch_insert('site_invoice_tracker', new_invoices)
        
    if new_finances:
        print("\nInserting into site_finance_tracker...")
        batch_insert('site_finance_tracker', new_finances)
        
    print("\n✓ July 2026 Direct migration completed successfully!")

if __name__ == '__main__':
    run_direct()
