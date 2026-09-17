import json, re, difflib, urllib.request
from dotenv import dotenv_values

config = dotenv_values('.env.local')
url = config.get('VITE_SUPABASE_URL')
key = config.get('SUPABASE_SERVICE_ROLE_KEY') or config.get('VITE_SUPABASE_SERVICE_ROLE_KEY') or config.get('VITE_SUPABASE_ANON_KEY')

with open('scratch/parsed_deployment.json') as f:
    excel_sites = json.load(f)

req = urllib.request.Request(f'{url}/rest/v1/organizations?select=id,short_name,full_name,manpower_approved_count', headers={
    'apikey': key,
    'Authorization': f'Bearer {key}'
})

with urllib.request.urlopen(req) as resp:
    db_orgs = json.loads(resp.read().decode('utf-8'))

def clean_key(s):
    return re.sub(r'[^a-z0-9]', '', str(s).lower())

excel_clean = {clean_key(k): (k, v) for k, v in excel_sites.items()}

matched = []
unmatched_db = []

# Manual aliases for known differences
ALIAS_MAP = {
    clean_key('42 Estate Queens Square'): clean_key('42 ESTATES QUEENS SQUARE'),
    clean_key('Aeris Residences'): clean_key('ARATT AERIS'),
    clean_key('Alanoville (Hariyana & Goyal Co)'): clean_key('ALANOVILLE- HARYAN & GOYAL CO'),
    clean_key('Alanoville (Haryana & Goyal Co)'): clean_key('ALANOVILLE- HARYAN & GOYAL CO'),
    clean_key('Akshaya Patra'): clean_key('AKSHAYA PATRA - ISKCON'),
    clean_key('Nikoo Paradigm'): clean_key('NIKOO HOMES'),
    clean_key('Nikoo Homes'): clean_key('NIKOO HOMES'),
    clean_key('Brigade Cornerstone Utopia'): clean_key('BRIGADE CORNERSTONE UTOPIA - SERENE'),
    clean_key('Brigade Utopia'): clean_key('BRIGADE CORNERSTONE UTOPIA - SERENE'),
    clean_key('Sobha City'): clean_key('SOBHA CITY MYKONOS'),
    clean_key('Mantri Elegance'): clean_key('MANTRI ELEGANCE'),
    clean_key('Ahad Euphoria'): clean_key('AHAD EUPHORIA'),
    clean_key('Shriram Smrithi'): clean_key('SHRIRAM SMRITHI'),
    clean_key('Janhavi Shelters'): clean_key('JANHAVI SHELTER'),
    clean_key('Sterling Terraces'): clean_key('STERLING TERRACES'),
    clean_key('Assetz Soul & Soil'): clean_key('ASSETZ SOUL AND SOIL - PHASE I & II'),
    clean_key('Assetz Soul and Soil'): clean_key('ASSETZ SOUL AND SOIL - PHASE I & II'),
    clean_key('Kolte Patil I-Towers Excente'): clean_key('KOLTE PATIL I TOWERS'),
    clean_key('Kolte Patil Mirabilis'): clean_key('KOLTE PATIL MIRABILIS'),
    clean_key('Birla Alokya'): clean_key('BIRLA ALOKYA'),
    clean_key('Bollineni Silas'): clean_key('BOLLINENI SILAS'),
    clean_key('Purva Venezia'): clean_key('PURVA VENEZIA'),
    clean_key('Purva Palm Beach'): clean_key('PURVA PALM BEACH'),
    clean_key('Prestige Oasis'): clean_key('PRESTIGE OASIS'),
    clean_key('Prestige Notting Hill'): clean_key('PRESTIGE NOTTING HILLS'),
    clean_key('Prestige South Ridge'): clean_key('PRESTIGE SOUTH RIDGE'),
    clean_key('Prestige Gulmohar'): clean_key('PRESTIGE GULMOHAR'),
    clean_key('Prestige Garden Bay'): clean_key('PRESTIGE GARDEN BAY'),
    clean_key('SNN Raj Lakeview'): clean_key('SNN RAJ LAKEVIEW'),
    clean_key('SNN Spiritua'): clean_key('SNN SPIRITUA'),
    clean_key('SNN Greenbay'): clean_key('SNN GREENBAY'),
    clean_key('SNN Clermont'): clean_key('SNN CLERMONT MARKETING OFFICE'),
    clean_key('SNN Raj Viviente'): clean_key('SNN RAJ VIVIENTE'),
    clean_key('SNN Raj Bay Vista'): clean_key('SNN RAJA BAY VISTA'),
    clean_key('SNN Duomont'): clean_key('SNN DUOMONT'),
    clean_key('SNN Etternia'): clean_key('SNN ETTERNIA'),
    clean_key('SNN Bellahalli'): clean_key('SNN BELLAHALLI'),
    clean_key('SNN Estate Felicity'): clean_key('SNN ESTATE FELICITY'),
    clean_key('Uber Verdant Phase 2'): clean_key('UBER VERDANT PHASE 2'),
    clean_key('Uber Verdant'): clean_key('UBER VERDANT PHASE 2'),
    clean_key('Sumadhura Silver Ripples'): clean_key('SUMADURA SILVER RIPPLES'),
    clean_key('The Promont'): clean_key('THE PROMONT HOUSING'),
    clean_key('Blue Waters'): clean_key('BLUE WATERS BY SJR PRIME CORP'),
    clean_key('Raja Ritz Avenue'): clean_key('RAJA RITZ AVENUE'),
    clean_key('Raja Woods Park'): clean_key('RAJA WOODS PARKK'),
    clean_key('Raja Prakruthi'): clean_key('RAJA PRAKRUTHI'),
    clean_key('Raja Four Squares'): clean_key('RAJA FOUR SQUARES'),
    clean_key('Habitat Illuminar'): clean_key('HABITAT ILLUMINAR'),
    clean_key('Habitat Eden Heights'): clean_key('HABITAT EDEN HEIGHTS'),
    clean_key('Habitat Aura'): clean_key('HABITAT AURA'),
    clean_key('Mahendra Aarna'): clean_key('MAHENDRA AARNA'),
    clean_key('Mahindra Windchimes'): clean_key('MAHINDRA WINDCHIMES'),
    clean_key('Advaitha Aksha'): clean_key('ADVAITHA AKSHA'),
    clean_key('Bren Paddington'): clean_key('BREN PADDINGTON'),
    clean_key('SJR Spencer'): clean_key('SJR SPENCER'),
    clean_key('SJR Verity'): clean_key('SJR VERITY'),
    clean_key('Shiram Chirping Woods'): clean_key('SHRIRAM CHIRPING WOODS'),
    clean_key('Shriram Chirping Woods'): clean_key('SHRIRAM CHIRPING WOODS'),
    clean_key('Shriram Signiaa'): clean_key('SHRIRAM SIGNIAA'),
    clean_key('Shriram Spurthi'): clean_key('SHRIRAM SPURTHI'),
    clean_key('Sobha Chrysanthemum'): clean_key('SOBHA CHRYSANTHEMUM'),
    clean_key('Sobha Dew Flower'): clean_key('SOBHA DEW FLOWER'),
    clean_key('Sobha Morzaria'): clean_key('SOBHA MORZARIA'),
    clean_key('Sobha Silicon Oasis'): clean_key('SOBHA SILICON OASIS'),
    clean_key('Mantri Tranquil'): clean_key('MANTRI TRANQUIL'),
    clean_key('Mantri Premero'): clean_key('MANTRI PREMERO'),
    clean_key('National Public School - Whitefield'): clean_key('NATIONAL PUBLIC SCHOOL WHITEFIELD'),
    clean_key('National Public School - Sarjapur'): clean_key('NATIONAL PUBLIC SCHOOL - SARJAPUR'),
    clean_key('National Public School - Marathahalli'): clean_key('NATIONAL PUBLIC SCHOOL MARATHAHALLI'),
    clean_key('Sri Kumaran Childrens Home'): clean_key("SRI KUMARAN CHILDREN'S HOME"),
    clean_key('Sri Kumaran Children Home'): clean_key("SRI KUMARAN CHILDREN'S HOME"),
    clean_key('Basil Woods - Lakshmipuram'): clean_key('BASIL WOODS - Lakshmipuram'),
    clean_key('Basil Woods - Malleswaram'): clean_key('BASIL WOODS - Malleswaram'),
    clean_key('Aikyam - Rameshwaram Cafe'): clean_key('AIKYAM - RAMESHWARAM CAFE'),
    clean_key('Pramukh MM Meridian'): clean_key('PRAMUKH MM MERIDIAN'),
    clean_key('Urban Greens'): clean_key('URBAN GREENS'),
    clean_key('Urban Serenity'): clean_key('URBAN SERENITY'),
    clean_key('VBHC Serene Town'): clean_key('VBHC SERENE TOWN'),
    clean_key('Elita Promenade'): clean_key('ELITA PROMENADE'),
    clean_key('DSR Eden Greens'): clean_key('DSR EDEN GREENS'),
    clean_key('DSR Woodwinds'): clean_key('DSR WOODWINDS'),
    clean_key('GR Sankalpa'): clean_key('GR SANKALPA'),
    clean_key('GR Residency'): clean_key('GR GR RESIDENCY'),
    clean_key('GR GR Residency'): clean_key('GR GR RESIDENCY'),
    clean_key('42 Mark One Villa'): clean_key('42 MARK ONE VILLA'),
    clean_key('Citrus Trail Farm & Kitchen'): clean_key('CITRUS TRAIL FARM & KITCHEN'),
    clean_key('Meadow In The Sun'): clean_key('MEADOW IN THE SUN'),
    clean_key('Arvind Skyland'): clean_key('ARVIND SKYLAND'),
    clean_key('Jain Heights'): clean_key('JAIN HEIGHTS'),
    clean_key('Salarpuria Luxuria'): clean_key('SALARPURIA LUXURIA'),
    clean_key('Tata Sherwood'): clean_key('TATA SHERWOOD'),
    clean_key('Citilight'): clean_key('CITILIGHT'),
    clean_key('MJ Amadeus'): clean_key('MJ AMADEUS'),
    clean_key('Garden Mansion'): clean_key('GARDEN MANSION'),
    clean_key('Arya Hamsa'): clean_key('ARYA HAMSA'),
    clean_key('The Imperial Address'): clean_key('THE IMPERIAL ADDRESS'),
    clean_key('The County Address'): clean_key('THE COUNTY ADDRESS'),
    clean_key('The Lake View Address'): clean_key('THE LAKE VIEW ADDRESS'),
    clean_key('The Central Regency'): clean_key('THE CENTRAL REGENCY'),
    clean_key('Nadathur Fame India'): clean_key('NADATHUR FAME INDIA'),
    clean_key('Bluejay Aster'): clean_key('BLUEJAY ASTER'),
    clean_key('August Park'): clean_key('AUGUST PARK'),
    clean_key('Krishvi Wisteria'): clean_key('KRISHVI WISTERIA'),
}

for org in db_orgs:
    s_clean = clean_key(org['short_name'])
    f_clean = clean_key(org.get('full_name') or '')
    id_clean = clean_key(org['id'])

    target_clean = ALIAS_MAP.get(s_clean) or ALIAS_MAP.get(f_clean) or ALIAS_MAP.get(id_clean)

    if not target_clean:
        if s_clean in excel_clean:
            target_clean = s_clean
        elif f_clean in excel_clean:
            target_clean = f_clean
        elif id_clean in excel_clean:
            target_clean = id_clean

    if target_clean and target_clean in excel_clean:
        orig_name, details = excel_clean[target_clean]
        matched.append({
            'org_id': org['id'],
            'short_name': org['short_name'],
            'excel_name': orig_name,
            'total_manpower': details['total'],
            'departments': details['departments']
        })
    else:
        unmatched_db.append(org)

print(f'Matched DB orgs: {len(matched)}')
print(f'Unmatched DB orgs: {len(unmatched_db)}')

print('\nSample matched orgs with manpower:')
for m in matched[:20]:
    print(f"{m['short_name']} -> {m['excel_name']} = {m['total_manpower']} (Depts: {m['departments']})")
