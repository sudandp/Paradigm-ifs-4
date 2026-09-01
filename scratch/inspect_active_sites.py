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

    sheet6 = parse_sheet(6) # Sudhan Data
    print("Total rows in Sheet 6 (Sudhan Data):", len(sheet6))
    for r in sheet6[:15]:
        print([r.get(col, '') for col in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']])
