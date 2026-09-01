import zipfile
import xml.etree.ElementTree as ET

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

    sheet1_rows = parse_sheet(1)
    blr_sites_rows = parse_sheet(2)

    # Address mapping
    addresses = {}
    for r in sheet1_rows:
        soc_name = r.get('F', '').strip()
        bill_name = r.get('G', '').strip()
        addr = r.get('H', '').strip()
        if soc_name and addr:
            addresses[soc_name.lower()] = addr
        if bill_name and addr:
            addresses[bill_name.lower()] = addr

    items = []
    curr_site = ""
    curr_sl = ""
    curr_short = ""
    purva_venezia_count = 0

    for idx, r in enumerate(blr_sites_rows):
        sl = r.get('A', '').strip()
        site_name = r.get('B', '').strip()
        gate = r.get('C', '').strip()
        lat = r.get('D', '').strip()
        lng = r.get('E', '').strip()
        short_name = r.get('G', '').strip()

        if sl:
            curr_sl = sl
        if site_name:
            curr_site = site_name
        if short_name:
            curr_short = short_name

        if not lat or not lng:
            continue

        try:
            f_lat = float(lat)
            f_lng = float(lng)
        except ValueError:
            continue

        # Handle specific fixes
        # Mantri Elegance typo fix: 77.99958 -> 77.60118
        if 'Mantri Elegance' in curr_site and 'Entry' in gate and f_lng > 77.9:
            f_lng = 77.60118

        disp_name = curr_site
        if 'Purva Venezia' in curr_site:
            purva_venezia_count += 1
            gate = f"Gate {purva_venezia_count}"

        if gate:
            disp_name = f"{curr_site} - {gate}"

        # Match address
        matched_addr = addresses.get(curr_site.lower(), '')
        if not matched_addr:
            matched_addr = curr_site

        clean_addr = " ".join(matched_addr.split()).replace("'", "''")
        clean_name = " ".join(disp_name.split()).replace("'", "''")

        items.append({
            'sl': curr_sl,
            'name': clean_name,
            'address': clean_addr,
            'lat': f_lat,
            'lng': f_lng,
            'radius': 100,
            'kiosk_pin': '1234'
        })

    sql_lines = [
        "-- ============================================================================",
        "-- SQL Query: Insert Bengaluru Society & Gate Locations into public.locations",
        "-- Page Target: /#/hr/locations (Existing Locations Tab)",
        "-- Total Locations: " + str(len(items)),
        "-- ============================================================================",
        "",
        "-- Ensure column 'kiosk_pin' exists on public.locations",
        "ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS kiosk_pin TEXT DEFAULT '1234';",
        "",
        "INSERT INTO public.locations (name, address, latitude, longitude, radius, kiosk_pin)",
        "SELECT v.name, v.address, v.latitude, v.longitude, v.radius, v.kiosk_pin",
        "FROM (VALUES"
    ]

    val_lines = []
    for it in items:
        val_lines.append(f"    ('{it['name']}', '{it['address']}', {it['lat']}, {it['lng']}, {it['radius']}, '{it['kiosk_pin']}')")

    sql_lines.append(",\n".join(val_lines))
    sql_lines.append(") AS v(name, address, latitude, longitude, radius, kiosk_pin)")
    sql_lines.append("WHERE NOT EXISTS (")
    sql_lines.append("    SELECT 1 FROM public.locations l")
    sql_lines.append("    WHERE l.name = v.name")
    sql_lines.append("       OR (ABS(l.latitude - v.latitude) < 0.00008 AND ABS(l.longitude - v.longitude) < 0.00008)")
    sql_lines.append(");")
    sql_lines.append("")
    sql_lines.append("-- Verify inserted count")
    sql_lines.append("SELECT COUNT(*) AS total_existing_locations FROM public.locations;")

    full_sql = "\n".join(sql_lines)
    with open('scratch/insert_locations.sql', 'w', encoding='utf-8') as f:
        f.write(full_sql)

    print("Updated scratch/insert_locations.sql with", len(items), "records.")
