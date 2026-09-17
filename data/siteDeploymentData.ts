// Master Site-Based Deployment Data Matrix
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
export const SITE_DEPLOYMENT_RECORDS: SiteDeploymentRecord[] = [
  {
    "siteName": "JANHAVI SHELTER",
    "total": 9,
    "departments": {
      "mep": 2,
      "housekeeping": 6,
      "garden": 0,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "SOBHA CITY MYKONOS",
    "total": 25,
    "departments": {
      "mep": 7,
      "housekeeping": 13,
      "garden": 3,
      "security": 0,
      "administration": 2,
      "other": 0
    }
  },
  {
    "siteName": "MANTRI ELEGANCE",
    "total": 36,
    "departments": {
      "mep": 10,
      "housekeeping": 17,
      "garden": 5,
      "security": 0,
      "administration": 3,
      "other": 1
    }
  },
  {
    "siteName": "AHAD EUPHORIA",
    "total": 36,
    "departments": {
      "mep": 11,
      "housekeeping": 20,
      "garden": 3,
      "security": 0,
      "administration": 2,
      "other": 0
    }
  },
  {
    "siteName": "SOBHA DEW FLOWER",
    "total": 35,
    "departments": {
      "mep": 8,
      "housekeeping": 17,
      "garden": 7,
      "security": 0,
      "administration": 3,
      "other": 0
    }
  },
  {
    "siteName": "SHRIRAM SMRITHI",
    "total": 96,
    "departments": {
      "mep": 13,
      "housekeeping": 38,
      "garden": 9,
      "security": 31,
      "administration": 4,
      "other": 1
    }
  },
  {
    "siteName": "ASSETZ SOUL AND SOIL - PHASE I & II",
    "total": 35.5,
    "departments": {
      "mep": 8,
      "housekeeping": 7,
      "garden": 3,
      "security": 15.5,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "NVT OPEN SKY",
    "total": 2,
    "departments": {
      "mep": 0,
      "housekeeping": 1,
      "garden": 1,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "NVT SYMPHONY OF ORCHIDS",
    "total": 4,
    "departments": {
      "mep": 0,
      "housekeeping": 4,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "AZVEN BREATHE",
    "total": 18,
    "departments": {
      "mep": 3,
      "housekeeping": 5,
      "garden": 9,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "STERLING TERRACES",
    "total": 32,
    "departments": {
      "mep": 6,
      "housekeeping": 17,
      "garden": 5,
      "security": 0,
      "administration": 3,
      "other": 1
    }
  },
  {
    "siteName": "BRIGADE OMEGA",
    "total": 26,
    "departments": {
      "mep": 5,
      "housekeeping": 17,
      "garden": 0,
      "security": 0,
      "administration": 3,
      "other": 1
    }
  },
  {
    "siteName": "SJR VERITY",
    "total": 19,
    "departments": {
      "mep": 3,
      "housekeeping": 13,
      "garden": 2,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "Artisane Forest Breeze",
    "total": 24,
    "departments": {
      "mep": 4,
      "housekeeping": 9,
      "garden": 2,
      "security": 8,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "DSR EDEN GREENS",
    "total": 20,
    "departments": {
      "mep": 2,
      "housekeeping": 6,
      "garden": 1,
      "security": 9,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "OAKYARD",
    "total": 13,
    "departments": {
      "mep": 3,
      "housekeeping": 9,
      "garden": 0,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "PRESTIGE ST.JOHN'S\u00a0WOOD",
    "total": 7,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 7,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "SUBHA ELAN",
    "total": 9,
    "departments": {
      "mep": 3,
      "housekeeping": 5,
      "garden": 1,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "SOBHA MORZARIA",
    "total": 24,
    "departments": {
      "mep": 6,
      "housekeeping": 12,
      "garden": 4,
      "security": 0,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "SNN GREENBAY",
    "total": 57,
    "departments": {
      "mep": 10,
      "housekeeping": 42,
      "garden": 0,
      "security": 0,
      "administration": 5,
      "other": 0
    }
  },
  {
    "siteName": "DSR WOODWINDS",
    "total": 21,
    "departments": {
      "mep": 8,
      "housekeeping": 9,
      "garden": 1,
      "security": 0,
      "administration": 2,
      "other": 1
    }
  },
  {
    "siteName": "PURVA SUNSHINE",
    "total": 16,
    "departments": {
      "mep": 5,
      "housekeeping": 8,
      "garden": 1,
      "security": 0,
      "administration": 2,
      "other": 0
    }
  },
  {
    "siteName": "SHRIRAM SIGNIAA",
    "total": 24,
    "departments": {
      "mep": 6,
      "housekeeping": 12,
      "garden": 5,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "GINA SHALOM",
    "total": 21,
    "departments": {
      "mep": 5,
      "housekeeping": 6,
      "garden": 1,
      "security": 8,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "SNN SPIRITUA",
    "total": 16,
    "departments": {
      "mep": 4,
      "housekeeping": 4,
      "garden": 1,
      "security": 6,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "SNN SPIRITUA PROJECT",
    "total": 1,
    "departments": {
      "mep": 0,
      "housekeeping": 1,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "THE LAKE VIEW ADDRESS",
    "total": 25,
    "departments": {
      "mep": 8,
      "housekeeping": 6,
      "garden": 9,
      "security": 0,
      "administration": 2,
      "other": 0
    }
  },
  {
    "siteName": "NVT VAKSANA",
    "total": 14,
    "departments": {
      "mep": 4,
      "housekeeping": 4,
      "garden": 4,
      "security": 0,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "ARATT MILANO",
    "total": 8,
    "departments": {
      "mep": 1,
      "housekeeping": 5,
      "garden": 1,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "ARATT AERIS",
    "total": 16,
    "departments": {
      "mep": 5,
      "housekeeping": 8,
      "garden": 1,
      "security": 0,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "PALIWAL (TITANIUM)",
    "total": 40,
    "departments": {
      "mep": 14,
      "housekeeping": 8,
      "garden": 1,
      "security": 14,
      "administration": 2,
      "other": 1
    }
  },
  {
    "siteName": "FICO",
    "total": 5,
    "departments": {
      "mep": 5,
      "housekeeping": 0,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "SNN JAYANAGAR OFFICE",
    "total": 6,
    "departments": {
      "mep": 0,
      "housekeeping": 6,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "MANTRI PREMERO",
    "total": 7,
    "departments": {
      "mep": 4,
      "housekeeping": 0,
      "garden": 1,
      "security": 0,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "VAISHNAVI TERRACES",
    "total": 40,
    "departments": {
      "mep": 12,
      "housekeeping": 23,
      "garden": 4,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "NCC ASTER PARK",
    "total": 38,
    "departments": {
      "mep": 9,
      "housekeeping": 10,
      "garden": 3,
      "security": 14,
      "administration": 2,
      "other": 0
    }
  },
  {
    "siteName": "NATIONAL PUBLIC SCHOOL MARATHAHALLI",
    "total": 23,
    "departments": {
      "mep": 1,
      "housekeeping": 21,
      "garden": 0,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "NATIONAL PUBLIC SCHOOL WHITEFIELD",
    "total": 61,
    "departments": {
      "mep": 1,
      "housekeeping": 58,
      "garden": 0,
      "security": 0,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "NATIONAL PUBLIC SCHOOL - SARJAPUR",
    "total": 31,
    "departments": {
      "mep": 1,
      "housekeeping": 29,
      "garden": 0,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "KOLTE PATIL MIRABILIS",
    "total": 34,
    "departments": {
      "mep": 8,
      "housekeeping": 20,
      "garden": 5,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "PURVA SEASONS",
    "total": 18,
    "departments": {
      "mep": 13,
      "housekeeping": 0,
      "garden": 0,
      "security": 0,
      "administration": 5,
      "other": 0
    }
  },
  {
    "siteName": "BOLLINENI SILAS",
    "total": 56,
    "departments": {
      "mep": 8,
      "housekeeping": 15,
      "garden": 3,
      "security": 27,
      "administration": 2,
      "other": 1
    }
  },
  {
    "siteName": "THE COUNTY ADDRESS",
    "total": 34,
    "departments": {
      "mep": 6,
      "housekeeping": 5,
      "garden": 5,
      "security": 16,
      "administration": 2,
      "other": 0
    }
  },
  {
    "siteName": "ICON SANCTUARY",
    "total": 24,
    "departments": {
      "mep": 6,
      "housekeeping": 4,
      "garden": 2,
      "security": 10,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "TRANS INDUS",
    "total": 9,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 9,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "NVT MYSTIC GARDEN",
    "total": 11,
    "departments": {
      "mep": 3,
      "housekeeping": 4,
      "garden": 3,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "NVT ORCHID GARDEN",
    "total": 12,
    "departments": {
      "mep": 4,
      "housekeeping": 3,
      "garden": 3,
      "security": 0,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "SUMADURA SILVER RIPPLES",
    "total": 35,
    "departments": {
      "mep": 12,
      "housekeeping": 17,
      "garden": 2,
      "security": 0,
      "administration": 3,
      "other": 1
    }
  },
  {
    "siteName": "HABITAT ILLUMINAR",
    "total": 15,
    "departments": {
      "mep": 0,
      "housekeeping": 15,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "SOBHA CHRYSANTHEMUM",
    "total": 32,
    "departments": {
      "mep": 7,
      "housekeeping": 17,
      "garden": 4,
      "security": 0,
      "administration": 3,
      "other": 1
    }
  },
  {
    "siteName": "VAMSI RAM BUILDERS JYOTHI WOODS",
    "total": 8,
    "departments": {
      "mep": 1,
      "housekeeping": 5,
      "garden": 0,
      "security": 0,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "GODREJ E CITY",
    "total": 43,
    "departments": {
      "mep": 12,
      "housekeeping": 27,
      "garden": 0,
      "security": 0,
      "administration": 4,
      "other": 0
    }
  },
  {
    "siteName": "BHUVANA GREENS",
    "total": 14,
    "departments": {
      "mep": 3,
      "housekeeping": 8,
      "garden": 2,
      "security": 0,
      "administration": 0,
      "other": 1
    }
  },
  {
    "siteName": "RAJA WOODS PARKK",
    "total": 20,
    "departments": {
      "mep": 4,
      "housekeeping": 4,
      "garden": 2,
      "security": 8,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "PRESTIGE GARDEN BAY",
    "total": 25,
    "departments": {
      "mep": 4,
      "housekeeping": 12,
      "garden": 7,
      "security": 0,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "Essar Precision Engineering",
    "total": 2,
    "departments": {
      "mep": 0,
      "housekeeping": 2,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "SV Grandur",
    "total": 11,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 11,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "GR SANKALPA",
    "total": 18,
    "departments": {
      "mep": 6,
      "housekeeping": 8,
      "garden": 2,
      "security": 0,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "MEADOW IN THE SUN",
    "total": 20,
    "departments": {
      "mep": 5,
      "housekeeping": 11,
      "garden": 2,
      "security": 0,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "ARVIND SKYLAND",
    "total": 40,
    "departments": {
      "mep": 5,
      "housekeeping": 17,
      "garden": 2,
      "security": 14,
      "administration": 2,
      "other": 0
    }
  },
  {
    "siteName": "ALANOVILLE- HARYAN & GOYAL CO",
    "total": 14,
    "departments": {
      "mep": 4,
      "housekeeping": 4,
      "garden": 4,
      "security": 0,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "HABITAT EDEN HEIGHTS",
    "total": 28,
    "departments": {
      "mep": 3,
      "housekeeping": 12,
      "garden": 0,
      "security": 12,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "SNN RAJA BAY VISTA",
    "total": 2,
    "departments": {
      "mep": 0,
      "housekeeping": 2,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "SNN RAJ VIVIENTE",
    "total": 2,
    "departments": {
      "mep": 0,
      "housekeeping": 2,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "SNN CLERMONT MARKETING OFFICE",
    "total": 2,
    "departments": {
      "mep": 0,
      "housekeeping": 2,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "42 MARK ONE VILLA",
    "total": 24,
    "departments": {
      "mep": 5,
      "housekeeping": 5,
      "garden": 2,
      "security": 10,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "SNN CLERMONT PROJECT",
    "total": 2,
    "departments": {
      "mep": 0,
      "housekeeping": 2,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "SAI KRUPA ELITE",
    "total": 10,
    "departments": {
      "mep": 1,
      "housekeeping": 3,
      "garden": 1,
      "security": 4,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "GREEN WOOD",
    "total": 12,
    "departments": {
      "mep": 2,
      "housekeeping": 7,
      "garden": 2,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "SAKET COMMERCIAL",
    "total": 7,
    "departments": {
      "mep": 1,
      "housekeeping": 5,
      "garden": 0,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "BRIGADE LABURNUM",
    "total": 20,
    "departments": {
      "mep": 3,
      "housekeeping": 6,
      "garden": 2,
      "security": 8,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "BASIL WOODS - Lakshmipuram",
    "total": 3,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 3,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "BASIL WOODS - Malleswaram",
    "total": 1,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 1,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "GR GR RESIDENCY",
    "total": 11,
    "departments": {
      "mep": 3,
      "housekeeping": 7,
      "garden": 1,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "BRIGADE JACARANDA",
    "total": 25,
    "departments": {
      "mep": 2,
      "housekeeping": 10,
      "garden": 2,
      "security": 10,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "ADARSHA PALACE",
    "total": 15,
    "departments": {
      "mep": 4,
      "housekeeping": 7,
      "garden": 3,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "PRIDE PICASA",
    "total": 8,
    "departments": {
      "mep": 1,
      "housekeeping": 4,
      "garden": 1,
      "security": 0,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "RAJA PRAKRUTHI",
    "total": 11,
    "departments": {
      "mep": 3,
      "housekeeping": 6,
      "garden": 1,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "SNN ETTERNIA",
    "total": 3,
    "departments": {
      "mep": 0,
      "housekeeping": 3,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "ELAN HOMES",
    "total": 32,
    "departments": {
      "mep": 6,
      "housekeeping": 21,
      "garden": 0,
      "security": 0,
      "administration": 4,
      "other": 1
    }
  },
  {
    "siteName": "PURVA VENEZIA",
    "total": 74,
    "departments": {
      "mep": 21,
      "housekeeping": 43,
      "garden": 0,
      "security": 0,
      "administration": 9,
      "other": 1
    }
  },
  {
    "siteName": "MARATT PIMENTO",
    "total": 12,
    "departments": {
      "mep": 4,
      "housekeeping": 6,
      "garden": 1,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "MARAT PIMENTO PROJECT",
    "total": 0,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "SJR SPENCER",
    "total": 17,
    "departments": {
      "mep": 3,
      "housekeeping": 5,
      "garden": 1,
      "security": 6,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "ISKCON TTD",
    "total": 2,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 2,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "BREN PADDINGTON",
    "total": 23,
    "departments": {
      "mep": 8,
      "housekeeping": 11,
      "garden": 2,
      "security": 0,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "URBAN GREENS",
    "total": 21,
    "departments": {
      "mep": 4,
      "housekeeping": 5,
      "garden": 3,
      "security": 8,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "NVT LIFE SQUARE",
    "total": 9,
    "departments": {
      "mep": 5,
      "housekeeping": 3,
      "garden": 0,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "PURVA PALM BEACH",
    "total": 107,
    "departments": {
      "mep": 17,
      "housekeeping": 30,
      "garden": 0,
      "security": 51,
      "administration": 5,
      "other": 4
    }
  },
  {
    "siteName": "NVT STOPPING BY THE WOOD",
    "total": 1,
    "departments": {
      "mep": 0,
      "housekeeping": 1,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "PRESTIGE NOTTING HILLS",
    "total": 21,
    "departments": {
      "mep": 6,
      "housekeeping": 9,
      "garden": 4,
      "security": 0,
      "administration": 2,
      "other": 0
    }
  },
  {
    "siteName": "JAIN HEIGHTS",
    "total": 30,
    "departments": {
      "mep": 3,
      "housekeeping": 6,
      "garden": 3,
      "security": 17,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "SALARPURIA LUXURIA",
    "total": 32,
    "departments": {
      "mep": 10,
      "housekeeping": 16,
      "garden": 2,
      "security": 0,
      "administration": 3,
      "other": 1
    }
  },
  {
    "siteName": "SNN RAJ LAKEVIEW",
    "total": 44,
    "departments": {
      "mep": 13,
      "housekeeping": 26,
      "garden": 0,
      "security": 0,
      "administration": 5,
      "other": 0
    }
  },
  {
    "siteName": "GEM PARK",
    "total": 16,
    "departments": {
      "mep": 3,
      "housekeeping": 3,
      "garden": 3,
      "security": 6,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "MANTRI TRANQUIL",
    "total": 73,
    "departments": {
      "mep": 22,
      "housekeeping": 31,
      "garden": 13,
      "security": 0,
      "administration": 6,
      "other": 1
    }
  },
  {
    "siteName": "MAHENDRA AARNA",
    "total": 44.26,
    "departments": {
      "mep": 12.26,
      "housekeeping": 23,
      "garden": 5,
      "security": 0,
      "administration": 3,
      "other": 1
    }
  },
  {
    "siteName": "THE CENTRAL REGENCY",
    "total": 14,
    "departments": {
      "mep": 7,
      "housekeeping": 6,
      "garden": 0,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "RAJA RITZ AVENUE",
    "total": 45,
    "departments": {
      "mep": 9,
      "housekeeping": 14,
      "garden": 4,
      "security": 16,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "SNN ESTATE FELICITY",
    "total": 6,
    "departments": {
      "mep": 0,
      "housekeeping": 6,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "VBHC SERENE TOWN",
    "total": 10,
    "departments": {
      "mep": 3,
      "housekeeping": 6,
      "garden": 1,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "ELITA PROMENADE",
    "total": 14,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 14,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "PRESTIGE GULMOHAR",
    "total": 41,
    "departments": {
      "mep": 7,
      "housekeeping": 13,
      "garden": 2,
      "security": 16,
      "administration": 3,
      "other": 0
    }
  },
  {
    "siteName": "SOBHA SILICON OASIS",
    "total": 64,
    "departments": {
      "mep": 17,
      "housekeeping": 31,
      "garden": 12,
      "security": 0,
      "administration": 4,
      "other": 0
    }
  },
  {
    "siteName": "SHRIRAM SPURTHI",
    "total": 27,
    "departments": {
      "mep": 3,
      "housekeeping": 11,
      "garden": 1,
      "security": 11,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "TATA SHERWOOD",
    "total": 36,
    "departments": {
      "mep": 11,
      "housekeeping": 13,
      "garden": 8,
      "security": 0,
      "administration": 3,
      "other": 1
    }
  },
  {
    "siteName": "PRESTIGE SOUTH RIDGE",
    "total": 31,
    "departments": {
      "mep": 8,
      "housekeeping": 14,
      "garden": 8,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "UL INDIA",
    "total": 5,
    "departments": {
      "mep": 4,
      "housekeeping": 0,
      "garden": 0,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "CITILIGHT",
    "total": 23,
    "departments": {
      "mep": 3,
      "housekeeping": 7,
      "garden": 2,
      "security": 10,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "NIKOO HOMES",
    "total": 178,
    "departments": {
      "mep": 31,
      "housekeeping": 50,
      "garden": 12,
      "security": 72,
      "administration": 12,
      "other": 1
    }
  },
  {
    "siteName": "MJ AMADEUS",
    "total": 22,
    "departments": {
      "mep": 6,
      "housekeeping": 11,
      "garden": 3,
      "security": 0,
      "administration": 2,
      "other": 0
    }
  },
  {
    "siteName": "GARDEN MANSION",
    "total": 6,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 6,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "KESHAV SETLUR",
    "total": 2,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 2,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "MANIKCHAND",
    "total": 14,
    "departments": {
      "mep": 4,
      "housekeeping": 8,
      "garden": 1,
      "security": 0,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "BRIGADE BRICKLANE",
    "total": 29,
    "departments": {
      "mep": 8,
      "housekeeping": 15,
      "garden": 4,
      "security": 0,
      "administration": 2,
      "other": 0
    }
  },
  {
    "siteName": "42 ESTATES QUEENS SQUARE",
    "total": 17,
    "departments": {
      "mep": 7,
      "housekeeping": 5,
      "garden": 3,
      "security": 0,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "SRI KUMARAN CHILDREN'S HOME",
    "total": 19,
    "departments": {
      "mep": 0,
      "housekeeping": 19,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "MAHINDRA WINDCHIMES",
    "total": 63,
    "departments": {
      "mep": 11,
      "housekeeping": 21,
      "garden": 4,
      "security": 21,
      "administration": 4,
      "other": 2
    }
  },
  {
    "siteName": "AKSHAYA PATRA - ISKCON",
    "total": 3,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 3,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "ADVAITHA AKSHA",
    "total": 22,
    "departments": {
      "mep": 5,
      "housekeeping": 13,
      "garden": 2,
      "security": 0,
      "administration": 2,
      "other": 0
    }
  },
  {
    "siteName": "SHRIRAM CHIRPING WOODS",
    "total": 15,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 15,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "CITRUS TRAIL FARM & KITCHEN",
    "total": 10,
    "departments": {
      "mep": 1,
      "housekeeping": 0,
      "garden": 3,
      "security": 5,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "CHANEL INDIA PVT LTD",
    "total": 2,
    "departments": {
      "mep": 0,
      "housekeeping": 2,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "ARYA HAMSA",
    "total": 12,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 12,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "RAJA FOUR SQUARES",
    "total": 5,
    "departments": {
      "mep": 1,
      "housekeeping": 2,
      "garden": 0,
      "security": 2,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "NVT OIKOS",
    "total": 2,
    "departments": {
      "mep": 0,
      "housekeeping": 1,
      "garden": 1,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "THE IMPERIAL ADDRESS",
    "total": 7,
    "departments": {
      "mep": 1,
      "housekeeping": 3,
      "garden": 0,
      "security": 0,
      "administration": 2,
      "other": 1
    }
  },
  {
    "siteName": "WYZMINDZ SOLUTIONS",
    "total": 4,
    "departments": {
      "mep": 0,
      "housekeeping": 3,
      "garden": 0,
      "security": 1,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "TRASCCON",
    "total": 15,
    "departments": {
      "mep": 0,
      "housekeeping": 7,
      "garden": 0,
      "security": 8,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "NADATHUR FAME INDIA",
    "total": 26,
    "departments": {
      "mep": 1,
      "housekeeping": 16,
      "garden": 0,
      "security": 8,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "SNN DUOMONT",
    "total": 3,
    "departments": {
      "mep": 0,
      "housekeeping": 3,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "VRINDHAVAN - PG",
    "total": 1,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 1,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "LAKSHMI ENTERPRISES",
    "total": 11,
    "departments": {
      "mep": 0,
      "housekeeping": 4,
      "garden": 0,
      "security": 7,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "SUNNY GROVE",
    "total": 7,
    "departments": {
      "mep": 0,
      "housekeeping": 2,
      "garden": 0,
      "security": 4,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "URBAN SERENITY",
    "total": 4,
    "departments": {
      "mep": 4,
      "housekeeping": 0,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "THE PROMONT HOUSING",
    "total": 48.5,
    "departments": {
      "mep": 12.5,
      "housekeeping": 21,
      "garden": 8,
      "security": 0,
      "administration": 5,
      "other": 2
    }
  },
  {
    "siteName": "ARTISANE\u00a0PROJECTS",
    "total": 8,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 8,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "UBER VERDANT PHASE 2",
    "total": 66,
    "departments": {
      "mep": 8,
      "housekeeping": 27,
      "garden": 0,
      "security": 30,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "BLUE WATERS BY SJR PRIME CORP",
    "total": 39,
    "departments": {
      "mep": 0,
      "housekeeping": 32,
      "garden": 7,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "ISKCON VAIKUNTA HILL",
    "total": 4,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 4,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "BIRLA ALOKYA",
    "total": 50,
    "departments": {
      "mep": 8,
      "housekeeping": 16,
      "garden": 6,
      "security": 17,
      "administration": 2,
      "other": 1
    }
  },
  {
    "siteName": "HABITAT AURA",
    "total": 8,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 8,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "KOLTE PATIL I TOWERS",
    "total": 30,
    "departments": {
      "mep": 8,
      "housekeeping": 17,
      "garden": 2,
      "security": 0,
      "administration": 2,
      "other": 1
    }
  },
  {
    "siteName": "GK ISPATS PVT LTD",
    "total": 9,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 9,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "AIKYAM - RAMESHWARAM CAFE",
    "total": 13,
    "departments": {
      "mep": 0,
      "housekeeping": 0,
      "garden": 0,
      "security": 13,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "NVT A WONDERFUL WORLD",
    "total": 3,
    "departments": {
      "mep": 0,
      "housekeeping": 3,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "BLUEJAY ASTER",
    "total": 12,
    "departments": {
      "mep": 2,
      "housekeeping": 4,
      "garden": 1,
      "security": 4,
      "administration": 1,
      "other": 0
    }
  },
  {
    "siteName": "AUGUST PARK",
    "total": 31,
    "departments": {
      "mep": 7,
      "housekeeping": 10,
      "garden": 3,
      "security": 9,
      "administration": 1,
      "other": 1
    }
  },
  {
    "siteName": "PRAMUKH MM MERIDIAN",
    "total": 35,
    "departments": {
      "mep": 6,
      "housekeeping": 13,
      "garden": 2,
      "security": 11,
      "administration": 2,
      "other": 1
    }
  },
  {
    "siteName": "HEBBAL INFRA SPACE",
    "total": 7,
    "departments": {
      "mep": 0,
      "housekeeping": 7,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "SNN BELLAHALLI",
    "total": 4,
    "departments": {
      "mep": 0,
      "housekeeping": 4,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "PRESTIGE OASIS",
    "total": 59,
    "departments": {
      "mep": 10,
      "housekeeping": 13,
      "garden": 34,
      "security": 0,
      "administration": 2,
      "other": 0
    }
  },
  {
    "siteName": "BRIGADE CORNERSTONE UTOPIA - SERENE",
    "total": 89,
    "departments": {
      "mep": 14,
      "housekeeping": 33,
      "garden": 2,
      "security": 34,
      "administration": 5,
      "other": 1
    }
  },
  {
    "siteName": "KRISHVI WISTERIA",
    "total": 7,
    "departments": {
      "mep": 2,
      "housekeeping": 4,
      "garden": 1,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "NVT WHISPERING HUES",
    "total": 1,
    "departments": {
      "mep": 0,
      "housekeeping": 1,
      "garden": 0,
      "security": 0,
      "administration": 0,
      "other": 0
    }
  },
  {
    "siteName": "GLOBAL EDIFICE INFRA",
    "total": 8,
    "departments": {
      "mep": 0,
      "housekeeping": 3,
      "garden": 0,
      "security": 5,
      "administration": 0,
      "other": 0
    }
  }
];

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
