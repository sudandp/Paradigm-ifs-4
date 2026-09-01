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

    for sheet_name in z.namelist():
        if sheet_name.startswith('xl/worksheets/sheet'):
            print(f'=== SHEET: {sheet_name}')
            root = ET.fromstring(z.read(sheet_name))
            rows = root.findall('main:sheetData/main:row', ns)
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
                
                # Check for '/' or multiple names in any cell
                for col, val in row_dict.items():
                    if ('/' in val or '&' in val or ',' in val) and any(name in val.upper() for name in ['PRADEEP', 'ISAAC', 'SANDEEP', 'VENKAT', 'SHILPA', 'HARISH', 'KESHAV', 'POOJA', 'CHANDANA', 'ARPITA', 'SINCHANA', 'ARYA', 'CHETHAN']):
                        print(f"Row {r.attrib.get('r')}: Site = {row_dict.get('B')} | Col {col} = {val}")
