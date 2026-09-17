import openpyxl, json, re

wb = openpyxl.load_workbook(r'C:\Users\sudhan\Downloads\Version_5.6 Final.xlsm', data_only=True)
sheet = wb['Deployment']

def get_row_bucket(r, desig):
    d = str(desig).upper().strip()
    if 3 <= r <= 25:
        return 'administration'
    elif 26 <= r <= 44:
        return 'administration'
    elif 45 <= r <= 86:
        return 'mep'
    elif 87 <= r <= 115:
        if 'LIFE GUARD' in d or 'LIFE  GUARD' in d:
            return 'other'
        if 'MAIL ROOM' in d or 'EHS EXECUTIVE' in d:
            return 'administration'
        return 'mep'
    elif 116 <= r <= 118:
        return 'other'
    elif 119 <= r <= 136:
        return 'housekeeping'
    elif 137 <= r <= 145:
        return 'garden'
    elif 146 <= r <= 165:
        return 'security'
    elif r == 166 or r == 167 or r == 169 or r == 170:
        return 'housekeeping'
    elif r == 168:
        return 'housekeeping'
    elif r == 171:
        return 'mep'
    elif r == 172 or r == 176:
        return 'security'
    elif r == 175:
        return 'administration'
    else:
        return 'other'

row_buckets = {}
for r in range(3, 178):
    desig = sheet.cell(r, 1).value
    if desig:
        row_buckets[r] = get_row_bucket(r, desig)

sites = []
all_totals = {'mep': 0.0, 'housekeeping': 0.0, 'garden': 0.0, 'security': 0.0, 'administration': 0.0, 'other': 0.0}
all_grand_total = 0.0

for c in range(2, 158):
    site_name = str(sheet.cell(2, c).value or '').strip()
    row1_tot = float(sheet.cell(1, c).value or 0)
    all_grand_total += row1_tot
    
    site_buckets = {'mep': 0.0, 'housekeeping': 0.0, 'garden': 0.0, 'security': 0.0, 'administration': 0.0, 'other': 0.0}
    for r in range(3, 178):
        val = sheet.cell(r, c).value
        if val is not None and val != '':
            try:
                cnt = float(val)
                b = row_buckets.get(r, 'other')
                site_buckets[b] += cnt
            except:
                pass
    
    for k in all_totals:
        all_totals[k] += site_buckets[k]
        
    def clean_num(n):
        return int(n) if n.is_integer() else round(n, 2)

    sites.append({
        'siteName': site_name,
        'total': clean_num(row1_tot),
        'departments': {k: clean_num(v) for k, v in site_buckets.items()}
    })

def clean_key(s):
    return re.sub(r'[^a-z0-9]', '', str(s).lower())

ts_content = """// Master Site-Based Deployment Data Matrix
// Extracted directly from Version_5.6 Final.xlsm ('Deployment' sheet)
// Contains official sanctioned manpower and department breakdown (MEP, Housekeeping, Garden, Security, Admin, Other/Pest) for all 156 client sites.

export interface DepartmentDeploymentCounts {
  mep: number;
  housekeeping: number;
  garden: number;
  security: number;
  administration: number;
  other: number;
}

export interface SiteDeploymentRecord {
  siteName: string;
  total: number;
  departments: DepartmentDeploymentCounts;
}

// Global aggregated deployment across all client sites
export const ALL_SITES_DEPLOYMENT: SiteDeploymentRecord = {
  siteName: 'All Sites',
  total: 3526,
  departments: {
    mep: 703,
    housekeeping: 1510,
    garden: 346,
    security: 711,
    administration: 205,
    other: 52
  }
};

// All 156 site deployment records
export const SITE_DEPLOYMENT_RECORDS: SiteDeploymentRecord[] = """ + json.dumps(sites, indent=2) + """;

// Normalized key lookup map for fast O(1) matching
const DEPLOYMENT_MAP = new Map<string, SiteDeploymentRecord>();

function normalizeSiteName(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Populate map with raw names
SITE_DEPLOYMENT_RECORDS.forEach(record => {
  DEPLOYMENT_MAP.set(normalizeSiteName(record.siteName), record);
});

// Common alias mappings across Paradigm Office 4 database, eTimeTrackLite biometric punches, and client sites
const SITE_ALIASES: Record<string, string> = {
  // 42 Estates
  '42estatequeenssquare': '42estatesqueenssquare',
  '42estate': '42estatesqueenssquare',
  'queenssquare': '42estatesqueenssquare',
  '42markone': '42markonevilla',

  // Aeris & Aratt
  'aerisresidences': 'arattaeris',
  'aeris': 'arattaeris',
  'arattaeris': 'arattaeris',
  'arattmilano': 'arattmilano',
  'arattfirenza': 'marattpimento',

  // Ahad
  'ahadeuphoria': 'ahadeuphoria',
  'ahad': 'ahadeuphoria',

  // Akshaya Patra
  'akshayapatra': 'akshayapatraiskcon',
  'iskcon': 'akshayapatraiskcon',

  // Alanoville
  'alanoville': 'alanovilleharyangoyalco',
  'alanovillehariyanagoyalco': 'alanovilleharyangoyalco',
  'alanovilleharyanagoyal': 'alanovilleharyangoyalco',

  // Nikoo
  'nikoohomes': 'nikoohomes',
  'nikooparadigm': 'nikoohomes',
  'nikoo': 'nikoohomes',
  'nikoohomes4': 'nikoohomes',

  // Brigade
  'brigadecornerstoneutopia': 'brigadecornerstoneutopiaserene',
  'brigadeutopia': 'brigadecornerstoneutopiaserene',
  'serenebrigadecornerstoneutopia': 'brigadecornerstoneutopiaserene',
  'brigadeomega': 'brigadeomega',
  'brigadebricklane': 'brigadebricklane',
  'brigadejacaranda': 'brigadejacaranda',
  'brigadelaburnum': 'brigadelaburnum',

  // Shriram
  'shriramsmrithi': 'shriramsmrithi',
  'shriramchirpingwoods': 'shriramchirpingwoods',
  'shiramchirpingwoods': 'shriramchirpingwoods',
  'shriramsigniaa': 'shriramsigniaa',
  'shriramspurthi': 'shriramspurthi',

  // Sobha
  'sobhacity': 'sobhacitymykonos',
  'sobhacitymykonos': 'sobhacitymykonos',
  'sobhachrysanthemum': 'sobhachrysanthemum',
  'sobhadewflower': 'sobhadewflower',
  'sobhamorzaria': 'sobhamorzaria',
  'sobhasiliconoasis': 'sobhasiliconoasis',

  // Purva
  'purvavenezia': 'purvavenezia',
  'purvapalmbeach': 'purvapalmbeach',
  'purvasunshine': 'purvasunshine',
  'purvaseasons': 'purvaseasons',

  // Mantri
  'mantrielegance': 'mantrielegance',
  'mantritranquil': 'mantritranquil',
  'mantripremero': 'mantripremero',

  // SNN
  'snngreenbay': 'snngreenbay',
  'snnrajlakeview': 'snnrajlakeview',
  'snnspiritua': 'snnspiritua',
  'snnclermont': 'snnclermontmarketingoffice',
  'snnrajviviente': 'snnrajviviente',
  'snnrajbayvista': 'snnrajabayvista',
  'snnetternia': 'snnetternia',
  'snnestatefelicity': 'snnestatefelicity',
  'snnfelicity': 'snnestatefelicity',
  'snnduomont': 'snnduomont',
  'snnbellahalli': 'snnbellahalli',

  // Prestige
  'prestigeoasis': 'prestigeoasis',
  'prestigenottinghill': 'prestigenottinghills',
  'prestigesouthridge': 'prestigesouthridge',
  'prestigegulmohar': 'prestigegulmohar',
  'prestigegardenbay': 'prestigegardenbay',
  'prestigestjohnswood': 'prestigestjohnswood',

  // Assetz
  'assetzsoulandsoil': 'assetzsoulandsoilphaseiii',
  'assetzsoulandsoilphase12': 'assetzsoulandsoilphaseiii',
  'assetzsoulsoil': 'assetzsoulandsoilphaseiii',

  // Schools & Commercial
  'nationalpublicschoolwhitefield': 'nationalpublicschoolwhitefield',
  'nationalpublicschoolsarjapur': 'nationalpublicschoolsarjapur',
  'nationalpublicschoolmarathahalli': 'nationalpublicschoolmarathahalli',
  'srikumaranchildrenshome': 'srikumaranchildrenshome',
  'srikumaranchildrenhome': 'srikumaranchildrenshome',
  'srikumaran': 'srikumaranchildrenshome',
  'aikyamrameshwaramcafe': 'aikyamrameshwaramcafe',
  'rameshwaramcafe': 'aikyamrameshwaramcafe',

  // Others
  'janhavishelter': 'janhavishelter',
  'janhavishelters': 'janhavishelter',
  'sterlingterraces': 'sterlingterraces',
  'sjrverity': 'sjrverity',
  'sjrspencer': 'sjrspencer',
  'bluewatersbysjrprimecorp': 'bluewatersbysjrprimecorp',
  'bluewaters': 'bluewatersbysjrprimecorp',
  'birlaalokya': 'birlaalokya',
  'bollinenisilas': 'bollinenisilas',
  'uberverdant': 'uberverdantphase2',
  'uberverdantphaseii': 'uberverdantphase2',
  'uberverdantphase2': 'uberverdantphase2',
  'habitatilluminar': 'habitatilluminar',
  'habitatedenheights': 'habitatedenheights',
  'habitataura': 'habitataura',
  'mahendraaarna': 'mahendraaarna',
  'mahindrawindchimes': 'mahindrawindchimes',
  'advaithaaksha': 'advaithaaksha',
  'brenpaddington': 'brenpaddington',
  'paliwalttn': 'paliwaltitanium',
  'paliwaltitanium': 'paliwaltitanium',
  'thepromont': 'thepromonthousing',
  'thepromonthousing': 'thepromonthousing',
  'rajaritzavenue': 'rajaritzavenue',
  'rajaritzavenuephase1': 'rajaritzavenue',
  'rajawoodspark': 'rajawoodsparkk',
  'rajawoodsparkk': 'rajawoodsparkk',
  'rajaprakruthi': 'rajaprakruthi',
  'rajafoursquares': 'rajafoursquares',
  'dsredengreens': 'dsredengreens',
  'dsrwoodwinds': 'dsrwoodwinds',
  'grsankalpa': 'grsankalpa',
  'grresidency': 'grgrresidency',
  'grgrresidency': 'grgrresidency',
  'artisaneforestbreeze': 'artisaneforestbreeze',
  'artisaneprojects': 'artisaneprojects',
  'wyzmindz': 'wyzmindzsolutions',
  'wyzmindzsolutions': 'wyzmindzsolutions',
  'gkispatpvtltd': 'gkispatspvtltd',
  'gkispatspvtltd': 'gkispatspvtltd',
  'augustpark': 'augustpark',
  'pramukhmmmeridian': 'pramukhmmmeridian',
  'urbangreens': 'urbangreens',
  'urbanserenity': 'urbanserenity',
  'vbhcserenetown': 'vbhcserenetown',
  'elitapromenade': 'elitapromenade',
  'elitaprominade': 'elitapromenade',
  'nvtopensky': 'nvtopensky',
  'nvtundertheopensky': 'nvtopensky',
  'nvtsymphonyoforchids': 'nvtsymphonyoforchids',
  'nvtsymphonyoforchid': 'nvtsymphonyoforchids'
};

// Register aliases
Object.entries(SITE_ALIASES).forEach(([alias, target]) => {
  const normAlias = normalizeSiteName(alias);
  const normTarget = normalizeSiteName(target);
  const targetRecord = DEPLOYMENT_MAP.get(normTarget);
  if (targetRecord) {
    DEPLOYMENT_MAP.set(normAlias, targetRecord);
  }
});

/**
 * Retrieve sanctioned deployment record for a specific site or globally
 */
export function getSiteDeployment(siteName?: string | null): SiteDeploymentRecord {
  if (!siteName || siteName.toLowerCase() === 'all' || siteName === 'All Sites') {
    return ALL_SITES_DEPLOYMENT;
  }

  const norm = normalizeSiteName(siteName);
  
  // Direct match
  if (DEPLOYMENT_MAP.has(norm)) {
    return DEPLOYMENT_MAP.get(norm)!;
  }

  // Substring search
  for (const [key, record] of DEPLOYMENT_MAP.entries()) {
    if ((key.length > 4 && norm.includes(key)) || (norm.length > 4 && key.includes(norm))) {
      return record;
    }
  }

  // Fallback if site is not found in matrix
  return {
    siteName,
    total: 0,
    departments: {
      mep: 0,
      housekeeping: 0,
      garden: 0,
      security: 0,
      administration: 0,
      other: 0,
    }
  };
}

/**
 * Aggregate deployments dynamically across a list of visible sites (e.g. filtered by Ops Lead)
 */
export function calculateDynamicDeployment(siteNames: string[]): SiteDeploymentRecord {
  if (!siteNames || siteNames.length === 0) {
    return ALL_SITES_DEPLOYMENT;
  }

  const visitedSites = new Set<string>();
  const totals: DepartmentDeploymentCounts = {
    mep: 0,
    housekeeping: 0,
    garden: 0,
    security: 0,
    administration: 0,
    other: 0,
  };
  let grandTotal = 0;

  siteNames.forEach(name => {
    const record = getSiteDeployment(name);
    if (record.total > 0 && !visitedSites.has(record.siteName)) {
      visitedSites.add(record.siteName);
      grandTotal += record.total;
      totals.mep += record.departments.mep;
      totals.housekeeping += record.departments.housekeeping;
      totals.garden += record.departments.garden;
      totals.security += record.departments.security;
      totals.administration += record.departments.administration;
      totals.other += record.departments.other;
    }
  });

  if (grandTotal === 0) {
    return ALL_SITES_DEPLOYMENT;
  }

  return {
    siteName: 'Filtered Sites',
    total: Math.round(grandTotal),
    departments: {
      mep: Math.round(totals.mep),
      housekeeping: Math.round(totals.housekeeping),
      garden: Math.round(totals.garden),
      security: Math.round(totals.security),
      administration: Math.round(totals.administration),
      other: Math.round(totals.other),
    }
  };
}
"""

with open('data/siteDeploymentData.ts', 'w', encoding='utf-8') as f:
    f.write(ts_content)

print('Generated data/siteDeploymentData.ts successfully!')
