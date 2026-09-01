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

    sheet_path = 'xl/worksheets/sheet2.xml'
    root = ET.fromstring(z.read(sheet_path))
    rows = root.findall('main:sheetData/main:row', ns)
    print(f'Total rows in BLR Sites: {len(rows)}')
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
        r_num = r.attrib.get('r')
        a = row_dict.get('A', '')
        b = row_dict.get('B', '')
        c = row_dict.get('C', '')
        d = row_dict.get('D', '')
        e = row_dict.get('E', '')
        g = row_dict.get('G', '')
        print(f"Row {r_num:3s} | Sl: {a:3s} | Site Name: {b:60s} | Gate: {c:10s} | Lat: {d:18s} | Lng: {e:18s} | Short: {g}")
