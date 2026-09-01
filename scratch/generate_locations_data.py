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

        # Format name
        disp_name = curr_site
        if gate:
            disp_name = f"{curr_site} - {gate}"

        # Match address
        matched_addr = addresses.get(curr_site.lower(), '')
        if not matched_addr:
            matched_addr = curr_site

        # Clean address string
        clean_addr = " ".join(matched_addr.split()).replace("'", "''")
        clean_name = " ".join(disp_name.split()).replace("'", "''")

        items.append({
            'sl': curr_sl,
            'site_name': curr_site,
            'gate': gate,
            'disp_name': clean_name,
            'short_name': curr_short,
            'lat': f_lat,
            'lng': f_lng,
            'address': clean_addr
        })

    print(f"Total valid entries: {len(items)}")
    for i, it in enumerate(items, 1):
        print(f"{i:2d}. [{it['sl']:2s}] {it['disp_name'][:55]:55s} | Lat: {it['lat']:.6f} | Lng: {it['lng']:.6f}")
