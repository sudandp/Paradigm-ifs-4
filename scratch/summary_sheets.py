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

    wb_xml = ET.fromstring(z.read('xl/workbook.xml'))
    sheets = wb_xml.findall('main:sheets/main:sheet', ns)
    for idx, s in enumerate(sheets, start=1):
        name = s.attrib['name']
        sheet_path = f'xl/worksheets/sheet{idx}.xml'
        root = ET.fromstring(z.read(sheet_path))
        rows = root.findall('main:sheetData/main:row', ns)
        print(f"=== Sheet {idx}: {name} (Total rows: {len(rows)}) ===")
        # Print first 3 rows header/data
        for r in rows[:3]:
            row_dict = {}
            for c in r.findall('main:c', ns):
                cell_ref = c.attrib.get('r', '')
                v = c.find('main:v', ns)
                val = v.text if v is not None else ''
                if c.attrib.get('t') == 's' and val.isdigit():
                    val = sst[int(val)]
                row_dict[cell_ref] = val
            print(f"  Row {r.attrib.get('r')}: {list(row_dict.items())[:8]}")
