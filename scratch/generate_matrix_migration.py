import zipfile
import xml.etree.ElementTree as ET
import json

with zipfile.ZipFile('Society Registration Gate Location Information Form.xlsx', 'r') as z:
    ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    sst = []
    if 'xl/sharedStrings.xml' in z.namelist():
        sst_xml = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in sst_xml.findall('main:si', ns):
            t = ''.join([node.text for node in si.iter() if node.text])
            sst.append(t)

    def parse_sheet(sheet_idx):
        sheet_path = f'xl/worksheets/sheet{sheet_idx}.xml'
        root = ET.fromstring(z.read(sheet_path))
        rows = root.findall('main:sheetData/main:row', ns)
        data = []
        for r in rows:
            row_dict = {}
            for c in r.findall('main:c', ns):
                cell_ref = c.attrib.get('r', '')
                col_letter = ''.join([ch for ch in cell_ref if ch.isalpha()])
                v = c.find('main:v', ns)
                val = v.text if v is not None else ''
                if c.attrib.get('t') == 's' and val.isdigit():
                    val = sst[int(val)]
                row_dict[col_letter] = val
            data.append(row_dict)
        return data

    sheet6 = parse_sheet(6) # Sudhan Data
    header = sheet6[0]
    print("Header:", header)

    records = []
    for r in sheet6[1:]:
        sl = r.get('A', '').strip()
        site_name = r.get('B', '').strip()
        ops_mgr = r.get('C', '').strip()
        hr_inch = r.get('D', '').strip()
        accts_inch = r.get('E', '').strip()
        company = r.get('F', '').strip()
        no_of_flats = r.get('G', '').strip()
        takeover_raw = r.get('H', '').strip()
        billing_cycle = r.get('I', '').strip()
        gst_name = r.get('J', '').strip()
        buyer_addr = r.get('K', '').strip()
        voucher_type = r.get('L', '').strip()
        gstin = r.get('M', '').strip()
        pan = r.get('N', '').strip()

        if not site_name:
            continue

        # Clean strings
        def esc(val):
            return " ".join(str(val).split()).replace("'", "''")

        flats_val = "NULL"
        if no_of_flats and no_of_flats.isdigit():
            flats_val = no_of_flats

        # Convert excel serial date to YYYY-MM-DD if applicable
        takeover_val = "NULL"
        if takeover_raw and takeover_raw.isdigit():
            # Excel base date ~1899-12-30
            from datetime import datetime, timedelta
            try:
                d = datetime(1899, 12, 30) + timedelta(days=int(takeover_raw))
                takeover_val = f"'{d.strftime('%Y-%m-%d')}'::date"
            except:
                takeover_val = "NULL"
        elif takeover_raw:
            takeover_val = f"'{esc(takeover_raw)}'"

        records.append({
            'sl': sl,
            'site_name': esc(site_name),
            'ops_manager': esc(ops_mgr) if ops_mgr else 'UNASSIGNED',
            'hr_incharge': esc(hr_inch) if hr_inch else 'CHANDANA',
            'accounts_incharge': esc(accts_inch) if accts_inch else 'ARPITA',
            'company': esc(company) if company else 'PIFS',
            'flats': flats_val,
            'takeover_date': takeover_val,
            'billing_cycle': esc(billing_cycle) if billing_cycle else '3rd Billing Cycle',
            'gst_name': esc(gst_name),
            'buyer_addr': esc(buyer_addr),
            'voucher_type': esc(voucher_type) if voucher_type else 'B2B Sales',
            'gstin': esc(gstin),
            'pan': esc(pan)
        })

    print(f"Parsed {len(records)} active site records.")
    
    # Generate SQL
    sql = []
    sql.append("-- ============================================================================")
    sql.append("-- MIGRATION: Create & Seed Site Responsibility & Employee Routing Matrix")
    sql.append("-- Date: 2026-09-01")
    sql.append("-- ============================================================================")
    sql.append("")
    sql.append("BEGIN;")
    sql.append("")
    sql.append("-- 1. Create table public.site_responsibility_matrix")
    sql.append("""CREATE TABLE IF NOT EXISTS public.site_responsibility_matrix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE SET NULL,
    site_name TEXT NOT NULL UNIQUE,
    ops_manager_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ops_manager_name TEXT NOT NULL,
    hr_incharge_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    hr_incharge_name TEXT NOT NULL,
    accounts_incharge_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    accounts_incharge_name TEXT NOT NULL,
    site_supervisor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    site_supervisor_name TEXT,
    billing_company TEXT NOT NULL DEFAULT 'PIFS',
    billing_cycle TEXT DEFAULT '3rd Billing Cycle',
    units_count INTEGER,
    takeover_date TEXT,
    gstin TEXT,
    pan TEXT,
    billing_legal_name TEXT,
    buyer_address TEXT,
    voucher_type TEXT DEFAULT 'B2B Sales',
    escalation_tiers JSONB DEFAULT '[]'::jsonb,
    routing_rules JSONB DEFAULT '{
        "daily_attendance_report": ["ops_manager", "hr_incharge"],
        "missed_punch_alert": ["ops_manager", "site_supervisor"],
        "invoice_generation_alert": ["accounts_incharge"],
        "field_audit_tickets": ["ops_manager"],
        "staff_grievance_tickets": ["hr_incharge"]
    }'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);""")
    sql.append("")
    sql.append("-- 2. Enable RLS and create policies")
    sql.append("ALTER TABLE public.site_responsibility_matrix ENABLE ROW LEVEL SECURITY;")
    sql.append("DROP POLICY IF EXISTS \"Allow authenticated read site_responsibility_matrix\" ON public.site_responsibility_matrix;")
    sql.append("CREATE POLICY \"Allow authenticated read site_responsibility_matrix\" ON public.site_responsibility_matrix FOR SELECT TO authenticated USING (true);")
    sql.append("DROP POLICY IF EXISTS \"Allow admin/management manage site_responsibility_matrix\" ON public.site_responsibility_matrix;")
    sql.append("CREATE POLICY \"Allow admin/management manage site_responsibility_matrix\" ON public.site_responsibility_matrix FOR ALL TO authenticated USING (true) WITH CHECK (true);")
    sql.append("")
    sql.append("-- 3. Seed/Upsert all 105+ Active Sites Matrix")
    sql.append("INSERT INTO public.site_responsibility_matrix (")
    sql.append("    site_name, ops_manager_name, hr_incharge_name, accounts_incharge_name,")
    sql.append("    billing_company, billing_cycle, units_count, takeover_date, billing_legal_name,")
    sql.append("    buyer_address, voucher_type, gstin, pan, escalation_tiers")
    sql.append(") VALUES")

    val_lines = []
    for rec in records:
        # Construct standard 3-tier escalation JSON
        esc_tiers = json.dumps([
            {"level": 1, "role": "Site Supervisor", "name": "Site In-charge", "contact": "+91 80 4123 4567"},
            {"level": 2, "role": "Operations Manager", "name": rec['ops_manager'], "contact": "Direct Ops Line"},
            {"level": 3, "role": "Head of Operations", "name": "Management Desk", "contact": "support@paradigmfms.com"}
        ]).replace("'", "''")

        val_lines.append(f"""    ('{rec['site_name']}', '{rec['ops_manager']}', '{rec['hr_incharge']}', '{rec['accounts_incharge']}', '{rec['company']}', '{rec['billing_cycle']}', {rec['flats']}, {rec['takeover_date']}, '{rec['gst_name']}', '{rec['buyer_addr']}', '{rec['voucher_type']}', '{rec['gstin']}', '{rec['pan']}', '{esc_tiers}'::jsonb)""")

    sql.append(",\n".join(val_lines))
    sql.append("""ON CONFLICT (site_name) DO UPDATE SET
    ops_manager_name = EXCLUDED.ops_manager_name,
    hr_incharge_name = EXCLUDED.hr_incharge_name,
    accounts_incharge_name = EXCLUDED.accounts_incharge_name,
    billing_company = EXCLUDED.billing_company,
    billing_cycle = EXCLUDED.billing_cycle,
    units_count = COALESCE(EXCLUDED.units_count, public.site_responsibility_matrix.units_count),
    takeover_date = COALESCE(EXCLUDED.takeover_date, public.site_responsibility_matrix.takeover_date),
    billing_legal_name = COALESCE(EXCLUDED.billing_legal_name, public.site_responsibility_matrix.billing_legal_name),
    buyer_address = COALESCE(EXCLUDED.buyer_address, public.site_responsibility_matrix.buyer_address),
    voucher_type = COALESCE(EXCLUDED.voucher_type, public.site_responsibility_matrix.voucher_type),
    gstin = COALESCE(EXCLUDED.gstin, public.site_responsibility_matrix.gstin),
    pan = COALESCE(EXCLUDED.pan, public.site_responsibility_matrix.pan),
    updated_at = now();""")
    sql.append("")
    sql.append("-- 4. Automatically link user UUIDs where user names match public.users")
    sql.append("""UPDATE public.site_responsibility_matrix m
SET ops_manager_id = u.id
FROM public.users u
WHERE u.name ILIKE '%' || m.ops_manager_name || '%'
  AND m.ops_manager_id IS NULL
  AND m.ops_manager_name != 'UNASSIGNED';""")
    sql.append("")
    sql.append("""UPDATE public.site_responsibility_matrix m
SET hr_incharge_id = u.id
FROM public.users u
WHERE u.name ILIKE '%' || m.hr_incharge_name || '%'
  AND m.hr_incharge_id IS NULL;""")
    sql.append("")
    sql.append("""UPDATE public.site_responsibility_matrix m
SET accounts_incharge_id = u.id
FROM public.users u
WHERE u.name ILIKE '%' || m.accounts_incharge_name || '%'
  AND m.accounts_incharge_id IS NULL;""")
    sql.append("")
    sql.append("-- 5. Automatically link site_id where locations match")
    sql.append("""UPDATE public.site_responsibility_matrix m
SET site_id = l.id
FROM public.locations l
WHERE (l.name ILIKE m.site_name || '%' OR m.site_name ILIKE l.name || '%')
  AND m.site_id IS NULL;""")
    sql.append("")
    sql.append("COMMIT;")
    sql.append("")
    sql.append("-- Verify seeded count")
    sql.append("SELECT COUNT(*) AS total_matrix_sites FROM public.site_responsibility_matrix;")

    full_migration_sql = "\n".join(sql)
    with open('supabase/migrations/20260901_create_site_responsibility_matrix.sql', 'w', encoding='utf-8') as f:
        f.write(full_migration_sql)

    print("Successfully generated supabase/migrations/20260901_create_site_responsibility_matrix.sql with", len(records), "sites.")
