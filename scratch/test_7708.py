
import json
with open('scratch/serene_all_staff.json', 'r', encoding='utf-8') as sf:
    data = json.load(sf)
# Search all employees in json
for d, elist in data.items():
    for e in elist:
        if '7708' in str(e.get('bio_id')) or '7708' in str(e.get('sl')) or '7708' in str(e.get('ref')):
            print('Found in json:', d, e['bio_id'], e['name'])
