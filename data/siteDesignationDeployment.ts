// Master Designation-Wise Deployment Breakdown Plan
// Extracted directly from Version_5.6 Final.xlsm ('Deployment' sheet)
// Contains exact designation allocations per site for MEP, Housekeeping, Garden, Security, Admin, Other/Pest

export interface DesignationDeploymentItem {
  designation: string;
  count: number;
  department: 'mep' | 'housekeeping' | 'garden' | 'security' | 'administration' | 'other';
}

export const ALL_SITES_DESIGNATION_DEPLOYMENT: DesignationDeploymentItem[] = [
  {
    "designation": "HK - FEMALE",
    "count": 1144,
    "department": "housekeeping"
  },
  {
    "designation": "HK CLEANER",
    "count": 1138,
    "department": "housekeeping"
  },
  {
    "designation": "SECURITY GUARD",
    "count": 1064,
    "department": "security"
  },
  {
    "designation": "GARDENER",
    "count": 468,
    "department": "garden"
  },
  {
    "designation": "ELECTRICIAN",
    "count": 438,
    "department": "mep"
  },
  {
    "designation": "HK - MALE",
    "count": 354,
    "department": "housekeeping"
  },
  {
    "designation": "PLUMBER",
    "count": 350,
    "department": "mep"
  },
  {
    "designation": "SECURITY SUPERVISOR",
    "count": 184,
    "department": "security"
  },
  {
    "designation": "GARDEN - HELPER",
    "count": 162,
    "department": "garden"
  },
  {
    "designation": "STP OPERATOR",
    "count": 136,
    "department": "mep"
  },
  {
    "designation": "HK SUPERVISOR",
    "count": 130,
    "department": "housekeeping"
  },
  {
    "designation": "FACILITY MANAGER",
    "count": 118,
    "department": "administration"
  },
  {
    "designation": "POOL OPERATOR",
    "count": 110,
    "department": "mep"
  },
  {
    "designation": "PEST CONTROL OPERATOR",
    "count": 94,
    "department": "other"
  },
  {
    "designation": "HELPDESK",
    "count": 92,
    "department": "administration"
  },
  {
    "designation": "MULTI TECHNICIAN",
    "count": 92,
    "department": "mep"
  },
  {
    "designation": "LADY GUARD",
    "count": 76,
    "department": "security"
  },
  {
    "designation": "HK - RELIEVER",
    "count": 64,
    "department": "housekeeping"
  },
  {
    "designation": "OWC OPERATOR",
    "count": 36,
    "department": "housekeeping"
  },
  {
    "designation": "SENIOR ELECTRICIAN",
    "count": 36,
    "department": "mep"
  },
  {
    "designation": "HK - COMMON AREA",
    "count": 36,
    "department": "housekeeping"
  },
  {
    "designation": "GARDEN SUPERVISOR",
    "count": 34,
    "department": "garden"
  },
  {
    "designation": "HEAD GUARD",
    "count": 32,
    "department": "security"
  },
  {
    "designation": "STP CUM WTP OPERATOR",
    "count": 30,
    "department": "mep"
  },
  {
    "designation": "ASST FACILITY MANAGER",
    "count": 28,
    "department": "administration"
  },
  {
    "designation": "ESTATE MANAGER",
    "count": 26,
    "department": "administration"
  },
  {
    "designation": "AFM - TECHNICAL",
    "count": 24,
    "department": "other"
  },
  {
    "designation": "HK CLUB HOUSE",
    "count": 24,
    "department": "housekeeping"
  },
  {
    "designation": "SENIOR PLUMBER",
    "count": 22,
    "department": "mep"
  },
  {
    "designation": "PROPERTY MANAGER",
    "count": 20,
    "department": "administration"
  },
  {
    "designation": "SENIOR SECURITY GUARD",
    "count": 20,
    "department": "security"
  },
  {
    "designation": "TECHNICAL SUPERVISOR",
    "count": 18,
    "department": "administration"
  },
  {
    "designation": "OFFICE ASSISTANT",
    "count": 18,
    "department": "other"
  },
  {
    "designation": "GARBAGE COLLECTION",
    "count": 18,
    "department": "other"
  },
  {
    "designation": "SENIOR GARDENER",
    "count": 16,
    "department": "garden"
  },
  {
    "designation": "CLUB HOUSE EXECUTIVE",
    "count": 16,
    "department": "administration"
  },
  {
    "designation": "EQUIPMENTS  - HK CLEANERS",
    "count": 16,
    "department": "housekeeping"
  },
  {
    "designation": "PLUMBER CUM POOL OPERATOR",
    "count": 14,
    "department": "mep"
  },
  {
    "designation": "SWIMMING POOL CUM WTP OPERATOR",
    "count": 14,
    "department": "mep"
  },
  {
    "designation": "PLUMBER CUM WTP OPERATOR",
    "count": 12,
    "department": "mep"
  },
  {
    "designation": "ELECTRICAL SUPERVISOR",
    "count": 12,
    "department": "mep"
  },
  {
    "designation": "SECURITY OFFICER",
    "count": 10,
    "department": "security"
  },
  {
    "designation": "PLUMBING SUPERVISOR",
    "count": 10,
    "department": "mep"
  },
  {
    "designation": "PANTRY BOY",
    "count": 10,
    "department": "housekeeping"
  },
  {
    "designation": "FIRE ALARM TECHNICIAN",
    "count": 10,
    "department": "mep"
  },
  {
    "designation": "FIRE WARDEN",
    "count": 8,
    "department": "mep"
  },
  {
    "designation": "SECURITY - RELIEVER",
    "count": 8,
    "department": "security"
  },
  {
    "designation": "OFFICE ASSISTANT CUM HK CLEANER",
    "count": 8,
    "department": "housekeeping"
  },
  {
    "designation": "HEAD GARDENER",
    "count": 8,
    "department": "garden"
  },
  {
    "designation": "HK SUPERVISOR - SENIOR",
    "count": 8,
    "department": "housekeeping"
  },
  {
    "designation": "FACILITY EXECUTIVE",
    "count": 8,
    "department": "administration"
  },
  {
    "designation": "JUNIOR SECURITY GUARD",
    "count": 8,
    "department": "security"
  },
  {
    "designation": "HK FLOOR SUPERVISOR",
    "count": 8,
    "department": "housekeeping"
  },
  {
    "designation": "PATROLLING SECURITY GUARD",
    "count": 8,
    "department": "security"
  },
  {
    "designation": "RELIEVER - PLUMBING",
    "count": 6,
    "department": "mep"
  },
  {
    "designation": "CARPENTER",
    "count": 6,
    "department": "mep"
  },
  {
    "designation": "DG OPERATOR",
    "count": 6,
    "department": "mep"
  },
  {
    "designation": "WEEKLY OFF RELIEVER",
    "count": 6,
    "department": "other"
  },
  {
    "designation": "TECHNICAL MANAGER",
    "count": 6,
    "department": "administration"
  },
  {
    "designation": "TECHNICIAN",
    "count": 6,
    "department": "mep"
  },
  {
    "designation": "GENERAL MANAGER",
    "count": 6,
    "department": "administration"
  },
  {
    "designation": "FIRE AND SAFETY OFFICER",
    "count": 6,
    "department": "mep"
  },
  {
    "designation": "FACILITY MANAGER - TECHNICAL",
    "count": 4,
    "department": "administration"
  },
  {
    "designation": "AFM - SOFT",
    "count": 4,
    "department": "other"
  },
  {
    "designation": "JUNIOR ELECTRICIAN",
    "count": 4,
    "department": "mep"
  },
  {
    "designation": "JUNIOR STP",
    "count": 4,
    "department": "mep"
  },
  {
    "designation": "HK CLEANER SENIOR",
    "count": 4,
    "department": "housekeeping"
  },
  {
    "designation": "HV/AC TECHNICIAN",
    "count": 4,
    "department": "mep"
  },
  {
    "designation": "SENIOR MULTI TECHNICIAN",
    "count": 4,
    "department": "mep"
  },
  {
    "designation": "SOFT SERVICE EXECUTIVE",
    "count": 4,
    "department": "administration"
  },
  {
    "designation": "PLUMBER CUM POOL OPERATOR & WTP OPERATOR",
    "count": 4,
    "department": "mep"
  },
  {
    "designation": "SENIOR SECURITY SUPERVISOR",
    "count": 4,
    "department": "security"
  },
  {
    "designation": "HANDYMAN",
    "count": 4,
    "department": "mep"
  },
  {
    "designation": "LEAD ELECTRICIAN",
    "count": 4,
    "department": "mep"
  },
  {
    "designation": "ASST MANAGER CIVIL ENGINEER",
    "count": 4,
    "department": "administration"
  },
  {
    "designation": "CLUB HOUSE SUPERVISOR",
    "count": 4,
    "department": "administration"
  },
  {
    "designation": "PAINTER",
    "count": 4,
    "department": "other"
  },
  {
    "designation": "TECHNICAL EXECUTIVE",
    "count": 4,
    "department": "administration"
  },
  {
    "designation": "SENIOR TECHNICIAN",
    "count": 4,
    "department": "mep"
  },
  {
    "designation": "TECHNICAL EXECUTIVE.",
    "count": 4,
    "department": "administration"
  },
  {
    "designation": "CUSTOMER RELATIONSHIP MANAGER",
    "count": 4,
    "department": "administration"
  },
  {
    "designation": "SECURITY GUARD MAIN GATE",
    "count": 4,
    "department": "security"
  },
  {
    "designation": "GYM TRAINER",
    "count": 4,
    "department": "other"
  },
  {
    "designation": "MIS PROCUREMENT MANAGER",
    "count": 2,
    "department": "administration"
  },
  {
    "designation": "DG ENGINEER",
    "count": 2,
    "department": "mep"
  },
  {
    "designation": "ELECTRICAL SUPERVISOR - Reliever",
    "count": 2,
    "department": "mep"
  },
  {
    "designation": "RELIEVER CHARGES - MULTI, ELE, PLU, STP",
    "count": 2,
    "department": "mep"
  },
  {
    "designation": "PLUMBER CUM CARPENTER",
    "count": 2,
    "department": "mep"
  },
  {
    "designation": "JUNIOR MULTI TECHNICIAN",
    "count": 2,
    "department": "mep"
  },
  {
    "designation": "WATERBODY OPERATOR",
    "count": 2,
    "department": "mep"
  },
  {
    "designation": "WTP/RO OPERATOR",
    "count": 2,
    "department": "mep"
  },
  {
    "designation": "HK CLUB HOUSE - FEMALE",
    "count": 2,
    "department": "housekeeping"
  },
  {
    "designation": "STACK OPERATOR",
    "count": 2,
    "department": "other"
  },
  {
    "designation": "WTP OPERATOR",
    "count": 2,
    "department": "mep"
  },
  {
    "designation": "LIFE GUARD",
    "count": 2,
    "department": "security"
  },
  {
    "designation": "KAIPOND",
    "count": 2,
    "department": "other"
  },
  {
    "designation": "HK SUPERVISOR - JUNIOR",
    "count": 2,
    "department": "housekeeping"
  },
  {
    "designation": "MAISON",
    "count": 2,
    "department": "other"
  },
  {
    "designation": "HORTICULTURIST",
    "count": 2,
    "department": "garden"
  },
  {
    "designation": "SENIOR STP",
    "count": 2,
    "department": "mep"
  },
  {
    "designation": "JUNIOR TECHNICIAN",
    "count": 2,
    "department": "mep"
  },
  {
    "designation": "FACILITY MANAGER - SOFT SERVICE",
    "count": 2,
    "department": "administration"
  },
  {
    "designation": "CLUB HOUSE MANAGER",
    "count": 2,
    "department": "administration"
  },
  {
    "designation": "ASST MANAGER - HK",
    "count": 2,
    "department": "housekeeping"
  },
  {
    "designation": "CUSTOMER RELATION EXECUTIVE",
    "count": 2,
    "department": "administration"
  },
  {
    "designation": "EXECUTIVE - LIFT & PLUMBING",
    "count": 2,
    "department": "mep"
  },
  {
    "designation": "BUGGY DRIVERS",
    "count": 2,
    "department": "other"
  },
  {
    "designation": "MAIL ROOM",
    "count": 2,
    "department": "other"
  },
  {
    "designation": "BMS OPERATOR",
    "count": 2,
    "department": "other"
  },
  {
    "designation": "GARDENER SPRINKLER OPERATOR",
    "count": 2,
    "department": "garden"
  },
  {
    "designation": "SECURITY EXECUTIVE",
    "count": 2,
    "department": "security"
  },
  {
    "designation": "LIFE  GUARD",
    "count": 2,
    "department": "security"
  },
  {
    "designation": "FRONT OFFICE EXECUTIVE",
    "count": 2,
    "department": "administration"
  },
  {
    "designation": "ASST FACILITY MANAGER OPERATIONS",
    "count": 2,
    "department": "administration"
  },
  {
    "designation": "FIRE AND SAFETY EXECUTIVE",
    "count": 2,
    "department": "mep"
  },
  {
    "designation": "SENIOR FACILITY MANAGER",
    "count": 2,
    "department": "administration"
  },
  {
    "designation": "RELIEVER - ELECTRICIAN",
    "count": 2,
    "department": "mep"
  }
];

export const SITE_DESIGNATION_DEPLOYMENT: Record<string, DesignationDeploymentItem[]> = {
  "JANHAVI SHELTER": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "SOBHA CITY MYKONOS": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 10,
      "department": "housekeeping"
    },
    {
      "designation": "OWC OPERATOR",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 1,
      "department": "garden"
    }
  ],
  "MANTRI ELEGANCE": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ASST FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "SENIOR ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "RELIEVER - PLUMBING",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "CARPENTER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 12,
      "department": "housekeeping"
    },
    {
      "designation": "HK - RELIEVER",
      "count": 3,
      "department": "housekeeping"
    },
    {
      "designation": "OWC OPERATOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "SENIOR GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 4,
      "department": "garden"
    }
  ],
  "AHAD EUPHORIA": [
    {
      "designation": "FACILITY MANAGER - TECHNICAL",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 17,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "OWC OPERATOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "SENIOR GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 1,
      "department": "garden"
    }
  ],
  "SOBHA DEW FLOWER": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ASST FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 13,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 3,
      "department": "housekeeping"
    },
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 3,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 3,
      "department": "garden"
    }
  ],
  "SHRIRAM SMRITHI": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "MIS PROCUREMENT MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL SUPERVISOR",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "FIRE WARDEN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "DG ENGINEER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 18,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 12,
      "department": "housekeeping"
    },
    {
      "designation": "HK - RELIEVER",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 8,
      "department": "garden"
    },
    {
      "designation": "SECURITY OFFICER",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 4,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 24,
      "department": "security"
    }
  ],
  "ASSETZ SOUL AND SOIL - PHASE I & II": [
    {
      "designation": "PROPERTY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "SENIOR ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK - FEMALE",
      "count": 6,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "HEAD GUARD",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 8,
      "department": "security"
    },
    {
      "designation": "SECURITY - RELIEVER",
      "count": 1,
      "department": "security"
    }
  ],
  "NVT OPEN SKY": [
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "OFFICE ASSISTANT CUM HK CLEANER",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "NVT SYMPHONY OF ORCHIDS": [
    {
      "designation": "HK CLEANER",
      "count": 4,
      "department": "housekeeping"
    }
  ],
  "AZVEN BREATHE": [
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK CLEANER",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 7,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 2,
      "department": "garden"
    }
  ],
  "STERLING TERRACES": [
    {
      "designation": "ESTATE MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 8,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 6,
      "department": "housekeeping"
    },
    {
      "designation": "HK - RELIEVER",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "SENIOR GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 2,
      "department": "garden"
    }
  ],
  "BRIGADE OMEGA": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ASST FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 15,
      "department": "housekeeping"
    },
    {
      "designation": "OWC OPERATOR",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "SJR VERITY": [
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "SENIOR ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "SENIOR PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK CLEANER",
      "count": 13,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    }
  ],
  "Artisane Forest Breeze": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 3,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 5,
      "department": "security"
    }
  ],
  "DSR EDEN GREENS": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK - FEMALE",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 6,
      "department": "security"
    }
  ],
  "OAKYARD": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 7,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "PRESTIGE ST.JOHN'S\u00a0WOOD": [
    {
      "designation": "HEAD GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 5,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 1,
      "department": "garden"
    }
  ],
  "SUBHA ELAN": [
    {
      "designation": "STP CUM WTP OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    }
  ],
  "SOBHA MORZARIA": [
    {
      "designation": "ESTATE MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM POOL OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR - SENIOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 11,
      "department": "housekeeping"
    },
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 3,
      "department": "garden"
    }
  ],
  "SNN GREENBAY": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "AFM - TECHNICAL",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "AFM - SOFT",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HELPDESK",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "SENIOR ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 5,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 35,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 5,
      "department": "housekeeping"
    }
  ],
  "DSR WOODWINDS": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "SENIOR ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "JUNIOR ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "JUNIOR STP",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK - FEMALE",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    }
  ],
  "PURVA SUNSHINE": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 7,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    }
  ],
  "SHRIRAM SIGNIAA": [
    {
      "designation": "ASST FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 9,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 3,
      "department": "garden"
    }
  ],
  "GINA SHALOM": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 6,
      "department": "security"
    }
  ],
  "SNN SPIRITUA": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 3,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 3,
      "department": "security"
    }
  ],
  "SNN SPIRITUA PROJECT": [
    {
      "designation": "HK - FEMALE",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "THE LAKE VIEW ADDRESS": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM WTP OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 4,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 5,
      "department": "garden"
    }
  ],
  "NVT VAKSANA": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK - FEMALE",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 4,
      "department": "garden"
    }
  ],
  "ARATT MILANO": [
    {
      "designation": "FACILITY EXECUTIVE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    }
  ],
  "ARATT AERIS": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK CLEANER",
      "count": 8,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    }
  ],
  "PALIWAL (TITANIUM)": [
    {
      "designation": "AFM - TECHNICAL",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "ESTATE MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICAL SUPERVISOR - Reliever",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "ELECTRICAL SUPERVISOR",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "DG OPERATOR",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "SENIOR PLUMBER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "RELIEVER CHARGES - MULTI, ELE, PLU, STP",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK CLEANER SENIOR",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "HEAD GUARD",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "JUNIOR SECURITY GUARD",
      "count": 4,
      "department": "security"
    },
    {
      "designation": "SENIOR SECURITY GUARD",
      "count": 6,
      "department": "security"
    },
    {
      "designation": "OFFICE ASSISTANT",
      "count": 1,
      "department": "other"
    }
  ],
  "FICO": [
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM CARPENTER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HV/AC TECHNICIAN",
      "count": 1,
      "department": "mep"
    }
  ],
  "SNN JAYANAGAR OFFICE": [
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 5,
      "department": "housekeeping"
    }
  ],
  "MANTRI PREMERO": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "SENIOR PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "SENIOR MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "JUNIOR MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    }
  ],
  "VAISHNAVI TERRACES": [
    {
      "designation": "ASST FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "WEEKLY OFF RELIEVER",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "FIRE WARDEN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "WATERBODY OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 13,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 3,
      "department": "housekeeping"
    },
    {
      "designation": "OWC OPERATOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARBAGE COLLECTION",
      "count": 5,
      "department": "other"
    },
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 1,
      "department": "garden"
    }
  ],
  "NCC ASTER PARK": [
    {
      "designation": "PROPERTY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 8,
      "department": "housekeeping"
    },
    {
      "designation": "OWC OPERATOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 3,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 11,
      "department": "security"
    }
  ],
  "NATIONAL PUBLIC SCHOOL MARATHAHALLI": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 20,
      "department": "housekeeping"
    }
  ],
  "NATIONAL PUBLIC SCHOOL WHITEFIELD": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK FLOOR SUPERVISOR",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 50,
      "department": "housekeeping"
    },
    {
      "designation": "OFFICE ASSISTANT",
      "count": 4,
      "department": "other"
    }
  ],
  "NATIONAL PUBLIC SCHOOL - SARJAPUR": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK CLEANER",
      "count": 26,
      "department": "housekeeping"
    },
    {
      "designation": "OFFICE ASSISTANT",
      "count": 3,
      "department": "other"
    }
  ],
  "KOLTE PATIL MIRABILIS": [
    {
      "designation": "AFM - SOFT",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "SENIOR ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "RELIEVER - PLUMBING",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 14,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 3,
      "department": "housekeeping"
    },
    {
      "designation": "HK - RELIEVER",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HEAD GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 2,
      "department": "garden"
    }
  ],
  "PURVA SEASONS": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "CLUB HOUSE EXECUTIVE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 6,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 6,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    }
  ],
  "BOLLINENI SILAS": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM WTP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 11,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "OWC OPERATOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 3,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 24,
      "department": "security"
    }
  ],
  "THE COUNTY ADDRESS": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "SOFT SERVICE EXECUTIVE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK CLEANER",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 5,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 13,
      "department": "security"
    }
  ],
  "ICON SANCTUARY": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK - FEMALE",
      "count": 3,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 7,
      "department": "security"
    }
  ],
  "TRANS INDUS": [
    {
      "designation": "HEAD GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 6,
      "department": "security"
    },
    {
      "designation": "SENIOR SECURITY GUARD",
      "count": 2,
      "department": "security"
    }
  ],
  "NVT MYSTIC GARDEN": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM POOL OPERATOR & WTP OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK CLEANER",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 1,
      "department": "garden"
    }
  ],
  "NVT ORCHID GARDEN": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP CUM WTP OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK CLEANER",
      "count": 3,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 1,
      "department": "garden"
    }
  ],
  "SUMADURA SILVER RIPPLES": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "WTP/RO OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "WEEKLY OFF RELIEVER",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 10,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "HK CLUB HOUSE",
      "count": 2,
      "department": "housekeeping"
    }
  ],
  "HABITAT ILLUMINAR": [
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 10,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK - RELIEVER",
      "count": 2,
      "department": "housekeeping"
    }
  ],
  "SOBHA CHRYSANTHEMUM": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "AFM - TECHNICAL",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "SENIOR ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "SENIOR PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 13,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "OWC OPERATOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "SENIOR GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 2,
      "department": "garden"
    }
  ],
  "VAMSI RAM BUILDERS JYOTHI WOODS": [
    {
      "designation": "PROPERTY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "SWIMMING POOL CUM WTP OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK CLEANER",
      "count": 5,
      "department": "housekeeping"
    }
  ],
  "GODREJ E CITY": [
    {
      "designation": "AFM - TECHNICAL",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "PROPERTY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL SUPERVISOR",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "SWIMMING POOL CUM WTP OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 20,
      "department": "housekeeping"
    },
    {
      "designation": "HK SUPERVISOR - SENIOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLUB HOUSE - FEMALE",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "BHUVANA GREENS": [
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 7,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    }
  ],
  "RAJA WOODS PARKK": [
    {
      "designation": "PROPERTY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK - FEMALE",
      "count": 3,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SENIOR SECURITY SUPERVISOR",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "HEAD GUARD",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 3,
      "department": "security"
    }
  ],
  "PRESTIGE GARDEN BAY": [
    {
      "designation": "ASST FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM WTP OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 10,
      "department": "housekeeping"
    },
    {
      "designation": "OWC OPERATOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 4,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 2,
      "department": "garden"
    }
  ],
  "Essar Precision Engineering": [
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    }
  ],
  "SV Grandur": [
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 8,
      "department": "security"
    }
  ],
  "GR SANKALPA": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 6,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    }
  ],
  "MEADOW IN THE SUN": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HANDYMAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 8,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    }
  ],
  "ARVIND SKYLAND": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "AFM - TECHNICAL",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP CUM WTP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 14,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "SENIOR GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 12,
      "department": "security"
    }
  ],
  "ALANOVILLE- HARYAN & GOYAL CO": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK - FEMALE",
      "count": 3,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 2,
      "department": "garden"
    }
  ],
  "HABITAT EDEN HEIGHTS": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 9,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 9,
      "department": "security"
    }
  ],
  "SNN RAJA BAY VISTA": [
    {
      "designation": "HK - FEMALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "SNN RAJ VIVIENTE": [
    {
      "designation": "HK - FEMALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "SNN CLERMONT MARKETING OFFICE": [
    {
      "designation": "HK - FEMALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "42 MARK ONE VILLA": [
    {
      "designation": "PROPERTY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "STP CUM WTP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK CLEANER",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 7,
      "department": "security"
    }
  ],
  "SNN CLERMONT PROJECT": [
    {
      "designation": "HK - FEMALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "SAI KRUPA ELITE": [
    {
      "designation": "ESTATE MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK CLEANER",
      "count": 3,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 2,
      "department": "security"
    }
  ],
  "GREEN WOOD": [
    {
      "designation": "ESTATE MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK CLEANER",
      "count": 7,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    }
  ],
  "SAKET COMMERCIAL": [
    {
      "designation": "FACILITY EXECUTIVE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "STACK OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK - FEMALE",
      "count": 5,
      "department": "housekeeping"
    }
  ],
  "BRIGADE LABURNUM": [
    {
      "designation": "ESTATE MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 6,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SENIOR SECURITY SUPERVISOR",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 6,
      "department": "security"
    }
  ],
  "BASIL WOODS - Lakshmipuram": [
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 2,
      "department": "security"
    }
  ],
  "BASIL WOODS - Malleswaram": [
    {
      "designation": "SECURITY GUARD",
      "count": 1,
      "department": "security"
    }
  ],
  "GR GR RESIDENCY": [
    {
      "designation": "TECHNICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 7,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    }
  ],
  "BRIGADE JACARANDA": [
    {
      "designation": "ESTATE MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 9,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 8,
      "department": "security"
    }
  ],
  "ADARSHA PALACE": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "LEAD ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 6,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 3,
      "department": "garden"
    }
  ],
  "PRIDE PICASA": [
    {
      "designation": "ESTATE MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK - FEMALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    }
  ],
  "RAJA PRAKRUTHI": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK CLEANER",
      "count": 6,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    }
  ],
  "SNN ETTERNIA": [
    {
      "designation": "HK - FEMALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "ELAN HOMES": [
    {
      "designation": "AFM - TECHNICAL",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "ASST MANAGER CIVIL ENGINEER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ESTATE MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 9,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 10,
      "department": "housekeeping"
    },
    {
      "designation": "OWC OPERATOR",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "PURVA VENEZIA": [
    {
      "designation": "AFM - TECHNICAL",
      "count": 2,
      "department": "other"
    },
    {
      "designation": "ASST MANAGER CIVIL ENGINEER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "PROPERTY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "CLUB HOUSE EXECUTIVE",
      "count": 3,
      "department": "administration"
    },
    {
      "designation": "ELECTRICAL SUPERVISOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 7,
      "department": "mep"
    },
    {
      "designation": "PLUMBING SUPERVISOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 7,
      "department": "mep"
    },
    {
      "designation": "WTP OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 42,
      "department": "housekeeping"
    }
  ],
  "MARATT PIMENTO": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "SENIOR ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    }
  ],
  "MARAT PIMENTO PROJECT": [],
  "SJR SPENCER": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "SENIOR ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK CLEANER",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SENIOR SECURITY GUARD",
      "count": 2,
      "department": "security"
    }
  ],
  "ISKCON TTD": [
    {
      "designation": "SECURITY GUARD",
      "count": 2,
      "department": "security"
    }
  ],
  "BREN PADDINGTON": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 7,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 3,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 1,
      "department": "garden"
    }
  ],
  "URBAN GREENS": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 3,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 6,
      "department": "security"
    }
  ],
  "NVT LIFE SQUARE": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM POOL OPERATOR & WTP OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 3,
      "department": "housekeeping"
    }
  ],
  "PURVA PALM BEACH": [
    {
      "designation": "GENERAL MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "AFM - TECHNICAL",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HELPDESK",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 6,
      "department": "mep"
    },
    {
      "designation": "SENIOR PLUMBER",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "LIFE GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SWIMMING POOL CUM WTP OPERATOR",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 2,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 23,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "SECURITY OFFICER",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "HEAD GUARD",
      "count": 3,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 43,
      "department": "security"
    },
    {
      "designation": "KAIPOND",
      "count": 1,
      "department": "other"
    }
  ],
  "NVT STOPPING BY THE WOOD": [
    {
      "designation": "OFFICE ASSISTANT CUM HK CLEANER",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "PRESTIGE NOTTING HILLS": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "SWIMMING POOL CUM WTP OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 8,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 4,
      "department": "garden"
    }
  ],
  "JAIN HEIGHTS": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "SENIOR ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "JUNIOR ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 13,
      "department": "security"
    }
  ],
  "SALARPURIA LUXURIA": [
    {
      "designation": "ASST FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "PROPERTY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL SUPERVISOR",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "SENIOR PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM WTP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "SENIOR MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK - FEMALE",
      "count": 11,
      "department": "housekeeping"
    },
    {
      "designation": "HK SUPERVISOR - SENIOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    }
  ],
  "SNN RAJ LAKEVIEW": [
    {
      "designation": "ASST FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ESTATE MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL SUPERVISOR",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "SENIOR ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "SENIOR PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK SUPERVISOR - JUNIOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 15,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 7,
      "department": "housekeeping"
    },
    {
      "designation": "OWC OPERATOR",
      "count": 2,
      "department": "housekeeping"
    }
  ],
  "GEM PARK": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK CLEANER",
      "count": 3,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 3,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 5,
      "department": "security"
    }
  ],
  "MANTRI TRANQUIL": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "AFM - TECHNICAL",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "CLUB HOUSE SUPERVISOR",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 9,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 9,
      "department": "mep"
    },
    {
      "designation": "MAISON",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "CARPENTER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PAINTER",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 29,
      "department": "housekeeping"
    },
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 10,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 2,
      "department": "garden"
    }
  ],
  "MAHENDRA AARNA": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL SUPERVISOR",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "STP CUM WTP OPERATOR",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "FIRE WARDEN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 15,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 6,
      "department": "housekeeping"
    },
    {
      "designation": "OWC OPERATOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 4,
      "department": "garden"
    }
  ],
  "THE CENTRAL REGENCY": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "WEEKLY OFF RELIEVER",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK CLEANER",
      "count": 6,
      "department": "housekeeping"
    }
  ],
  "RAJA RITZ AVENUE": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "STP CUM WTP OPERATOR",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 9,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK - RELIEVER",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 3,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 13,
      "department": "security"
    }
  ],
  "SNN ESTATE FELICITY": [
    {
      "designation": "HK - FEMALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "OFFICE ASSISTANT",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "PANTRY BOY",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "VBHC SERENE TOWN": [
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    }
  ],
  "ELITA PROMENADE": [
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 9,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 4,
      "department": "garden"
    }
  ],
  "PRESTIGE GULMOHAR": [
    {
      "designation": "PROPERTY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL SUPERVISOR",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 12,
      "department": "housekeeping"
    },
    {
      "designation": "SENIOR GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 3,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 13,
      "department": "security"
    }
  ],
  "SOBHA SILICON OASIS": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 7,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 7,
      "department": "mep"
    },
    {
      "designation": "PAINTER",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "FIRE AND SAFETY OFFICER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 21,
      "department": "housekeeping"
    },
    {
      "designation": "HK SUPERVISOR - SENIOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 8,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 6,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 5,
      "department": "garden"
    },
    {
      "designation": "HORTICULTURIST",
      "count": 1,
      "department": "garden"
    }
  ],
  "SHRIRAM SPURTHI": [
    {
      "designation": "ESTATE MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "SENIOR ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 10,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 8,
      "department": "security"
    }
  ],
  "TATA SHERWOOD": [
    {
      "designation": "ASST FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ESTATE MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL SUPERVISOR",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "SENIOR ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "SENIOR PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "SENIOR STP",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "JUNIOR STP",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK - FEMALE",
      "count": 9,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 3,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 4,
      "department": "garden"
    }
  ],
  "PRESTIGE SOUTH RIDGE": [
    {
      "designation": "ESTATE MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 11,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 3,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 4,
      "department": "garden"
    }
  ],
  "UL INDIA": [
    {
      "designation": "TECHNICAL EXECUTIVE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "SENIOR TECHNICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "JUNIOR TECHNICIAN",
      "count": 1,
      "department": "mep"
    }
  ],
  "CITILIGHT": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "SENIOR ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 6,
      "department": "housekeeping"
    },
    {
      "designation": "HK - RELIEVER",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 8,
      "department": "security"
    }
  ],
  "NIKOO HOMES": [
    {
      "designation": "GENERAL MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "FACILITY MANAGER - TECHNICAL",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "FACILITY MANAGER - SOFT SERVICE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "CLUB HOUSE MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 4,
      "department": "administration"
    },
    {
      "designation": "ASST MANAGER - HK",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "CLUB HOUSE EXECUTIVE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "CUSTOMER RELATION EXECUTIVE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL EXECUTIVE.",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "ELECTRICAL SUPERVISOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "SENIOR ELECTRICIAN",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBING SUPERVISOR",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 7,
      "department": "mep"
    },
    {
      "designation": "EXECUTIVE - LIFT & PLUMBING",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HV/AC TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "FIRE ALARM TECHNICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "FIRE AND SAFETY OFFICER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "BUGGY DRIVERS",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "MAIL ROOM",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "BMS OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 3,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 29,
      "department": "housekeeping"
    },
    {
      "designation": "OWC OPERATOR",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "EQUIPMENTS  - HK CLEANERS",
      "count": 8,
      "department": "housekeeping"
    },
    {
      "designation": "GARBAGE COLLECTION",
      "count": 4,
      "department": "other"
    },
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 7,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 3,
      "department": "garden"
    },
    {
      "designation": "GARDENER SPRINKLER OPERATOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY OFFICER",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 4,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 3,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 63,
      "department": "security"
    },
    {
      "designation": "HK CLUB HOUSE",
      "count": 4,
      "department": "housekeeping"
    }
  ],
  "MJ AMADEUS": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ASST FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 8,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 3,
      "department": "housekeeping"
    },
    {
      "designation": "SENIOR GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 1,
      "department": "garden"
    }
  ],
  "GARDEN MANSION": [
    {
      "designation": "SECURITY EXECUTIVE",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "HEAD GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 4,
      "department": "security"
    }
  ],
  "KESHAV SETLUR": [
    {
      "designation": "SECURITY GUARD",
      "count": 2,
      "department": "security"
    }
  ],
  "MANIKCHAND": [
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK - RELIEVER",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "SENIOR GARDENER",
      "count": 1,
      "department": "garden"
    }
  ],
  "BRIGADE BRICKLANE": [
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 10,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK - RELIEVER",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HEAD GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 3,
      "department": "garden"
    },
    {
      "designation": "CUSTOMER RELATIONSHIP MANAGER",
      "count": 1,
      "department": "administration"
    }
  ],
  "42 ESTATES QUEENS SQUARE": [
    {
      "designation": "ASST FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK CLEANER",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 1,
      "department": "garden"
    }
  ],
  "SRI KUMARAN CHILDREN'S HOME": [
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 14,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 4,
      "department": "housekeeping"
    }
  ],
  "MAHINDRA WINDCHIMES": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "AFM - TECHNICAL",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL EXECUTIVE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "CARPENTER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "FIRE AND SAFETY OFFICER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 15,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "OWC OPERATOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 18,
      "department": "security"
    },
    {
      "designation": "LIFE  GUARD",
      "count": 1,
      "department": "security"
    }
  ],
  "AKSHAYA PATRA - ISKCON": [
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 2,
      "department": "security"
    }
  ],
  "ADVAITHA AKSHA": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "CLUB HOUSE EXECUTIVE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 6,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK - RELIEVER",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "HK CLUB HOUSE",
      "count": 2,
      "department": "housekeeping"
    }
  ],
  "SHRIRAM CHIRPING WOODS": [
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 13,
      "department": "security"
    }
  ],
  "CITRUS TRAIL FARM & KITCHEN": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "GARDENER",
      "count": 3,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 4,
      "department": "security"
    }
  ],
  "CHANEL INDIA PVT LTD": [
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    }
  ],
  "ARYA HAMSA": [
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 9,
      "department": "security"
    }
  ],
  "RAJA FOUR SQUARES": [
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK CLEANER",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "SECURITY GUARD MAIN GATE",
      "count": 2,
      "department": "security"
    }
  ],
  "NVT OIKOS": [
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "OFFICE ASSISTANT CUM HK CLEANER",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "THE IMPERIAL ADDRESS": [
    {
      "designation": "CLUB HOUSE EXECUTIVE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK CLEANER",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "PANTRY BOY",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GYM TRAINER",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "CUSTOMER RELATIONSHIP MANAGER",
      "count": 1,
      "department": "administration"
    }
  ],
  "WYZMINDZ SOLUTIONS": [
    {
      "designation": "HK - FEMALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 1,
      "department": "security"
    }
  ],
  "TRASCCON": [
    {
      "designation": "HK - FEMALE",
      "count": 6,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 3,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 3,
      "department": "security"
    }
  ],
  "NADATHUR FAME INDIA": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 8,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 7,
      "department": "housekeeping"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 4,
      "department": "security"
    },
    {
      "designation": "SECURITY - RELIEVER",
      "count": 1,
      "department": "security"
    }
  ],
  "SNN DUOMONT": [
    {
      "designation": "HK - FEMALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "PANTRY BOY",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "VRINDHAVAN - PG": [
    {
      "designation": "SECURITY GUARD",
      "count": 1,
      "department": "security"
    }
  ],
  "LAKSHMI ENTERPRISES": [
    {
      "designation": "HK - FEMALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HEAD GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 6,
      "department": "security"
    }
  ],
  "SUNNY GROVE": [
    {
      "designation": "FRONT OFFICE EXECUTIVE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HK - FEMALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 3,
      "department": "security"
    },
    {
      "designation": "PANTRY BOY",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "URBAN SERENITY": [
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 2,
      "department": "mep"
    }
  ],
  "THE PROMONT HOUSING": [
    {
      "designation": "GENERAL MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "AFM - TECHNICAL",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "ASST FACILITY MANAGER OPERATIONS",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "FIRE AND SAFETY EXECUTIVE",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 20,
      "department": "housekeeping"
    },
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 7,
      "department": "garden"
    },
    {
      "designation": "GYM TRAINER",
      "count": 1,
      "department": "other"
    }
  ],
  "ARTISANE\u00a0PROJECTS": [
    {
      "designation": "SECURITY GUARD",
      "count": 8,
      "department": "security"
    }
  ],
  "UBER VERDANT PHASE 2": [
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "STP CUM WTP OPERATOR",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 20,
      "department": "housekeeping"
    },
    {
      "designation": "HK - RELIEVER",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "HK - COMMON AREA",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 26,
      "department": "security"
    }
  ],
  "BLUE WATERS BY SJR PRIME CORP": [
    {
      "designation": "HK SUPERVISOR",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 18,
      "department": "housekeeping"
    },
    {
      "designation": "HK - RELIEVER",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "HK - COMMON AREA",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 6,
      "department": "garden"
    },
    {
      "designation": "HK CLUB HOUSE",
      "count": 2,
      "department": "housekeeping"
    }
  ],
  "ISKCON VAIKUNTA HILL": [
    {
      "designation": "SECURITY GUARD",
      "count": 4,
      "department": "security"
    }
  ],
  "BIRLA ALOKYA": [
    {
      "designation": "SENIOR FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "CLUB HOUSE EXECUTIVE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - RELIEVER",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK - COMMON AREA",
      "count": 11,
      "department": "housekeeping"
    },
    {
      "designation": "HEAD GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 3,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "HEAD GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 10,
      "department": "security"
    },
    {
      "designation": "HK CLUB HOUSE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "SECURITY - RELIEVER",
      "count": 2,
      "department": "security"
    }
  ],
  "HABITAT AURA": [
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 3,
      "department": "security"
    },
    {
      "designation": "PATROLLING SECURITY GUARD",
      "count": 2,
      "department": "security"
    }
  ],
  "KOLTE PATIL I TOWERS": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "SOFT SERVICE EXECUTIVE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK CLEANER",
      "count": 17,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    }
  ],
  "GK ISPATS PVT LTD": [
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 7,
      "department": "security"
    }
  ],
  "AIKYAM - RAMESHWARAM CAFE": [
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "HEAD GUARD",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 9,
      "department": "security"
    }
  ],
  "NVT A WONDERFUL WORLD": [
    {
      "designation": "HK - FEMALE",
      "count": 3,
      "department": "housekeeping"
    }
  ],
  "BLUEJAY ASTER": [
    {
      "designation": "PROPERTY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK CLEANER",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 2,
      "department": "security"
    }
  ],
  "AUGUST PARK": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 9,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 3,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 5,
      "department": "security"
    }
  ],
  "PRAMUKH MM MERIDIAN": [
    {
      "designation": "ASST FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK CLEANER",
      "count": 13,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 8,
      "department": "security"
    }
  ],
  "HEBBAL INFRA SPACE": [
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 6,
      "department": "housekeeping"
    }
  ],
  "SNN BELLAHALLI": [
    {
      "designation": "HK - FEMALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "PANTRY BOY",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "PRESTIGE OASIS": [
    {
      "designation": "ASST FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL SUPERVISOR",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 5,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "HANDYMAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 11,
      "department": "housekeeping"
    },
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 16,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 16,
      "department": "garden"
    },
    {
      "designation": "OFFICE ASSISTANT CUM HK CLEANER",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "BRIGADE CORNERSTONE UTOPIA - SERENE": [
    {
      "designation": "FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ASST FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL SUPERVISOR",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "FACILITY EXECUTIVE",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 5,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 5,
      "department": "mep"
    },
    {
      "designation": "RELIEVER - PLUMBING",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "RELIEVER - ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "FIRE ALARM TECHNICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 31,
      "department": "housekeeping"
    },
    {
      "designation": "OWC OPERATOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 2,
      "department": "garden"
    },
    {
      "designation": "SECURITY OFFICER",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 29,
      "department": "security"
    },
    {
      "designation": "PATROLLING SECURITY GUARD",
      "count": 2,
      "department": "security"
    }
  ],
  "KRISHVI WISTERIA": [
    {
      "designation": "MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HK - FEMALE",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "GARDENER",
      "count": 1,
      "department": "garden"
    }
  ],
  "NVT WHISPERING HUES": [
    {
      "designation": "HK - FEMALE",
      "count": 1,
      "department": "housekeeping"
    }
  ],
  "GLOBAL EDIFICE INFRA": [
    {
      "designation": "HK - FEMALE",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HEAD GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 4,
      "department": "security"
    }
  ],
  "SUM OF DESIGNATED": [
    {
      "designation": "GENERAL MANAGER",
      "count": 3,
      "department": "administration"
    },
    {
      "designation": "FACILITY MANAGER - TECHNICAL",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "FACILITY MANAGER - SOFT SERVICE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "SENIOR FACILITY MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "FACILITY MANAGER",
      "count": 59,
      "department": "administration"
    },
    {
      "designation": "AFM - TECHNICAL",
      "count": 12,
      "department": "other"
    },
    {
      "designation": "AFM - SOFT",
      "count": 2,
      "department": "other"
    },
    {
      "designation": "ASST FACILITY MANAGER",
      "count": 14,
      "department": "administration"
    },
    {
      "designation": "ASST FACILITY MANAGER OPERATIONS",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "ASST MANAGER CIVIL ENGINEER",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "SOFT SERVICE EXECUTIVE",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL MANAGER",
      "count": 3,
      "department": "administration"
    },
    {
      "designation": "ESTATE MANAGER",
      "count": 13,
      "department": "administration"
    },
    {
      "designation": "CLUB HOUSE MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "CLUB HOUSE SUPERVISOR",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "PROPERTY MANAGER",
      "count": 10,
      "department": "administration"
    },
    {
      "designation": "MIS PROCUREMENT MANAGER",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "HELPDESK",
      "count": 46,
      "department": "administration"
    },
    {
      "designation": "ASST MANAGER - HK",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "CLUB HOUSE EXECUTIVE",
      "count": 8,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL SUPERVISOR",
      "count": 9,
      "department": "administration"
    },
    {
      "designation": "FACILITY EXECUTIVE",
      "count": 4,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL EXECUTIVE",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "FIRE AND SAFETY EXECUTIVE",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "FRONT OFFICE EXECUTIVE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "CUSTOMER RELATION EXECUTIVE",
      "count": 1,
      "department": "administration"
    },
    {
      "designation": "TECHNICAL EXECUTIVE.",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "ELECTRICAL SUPERVISOR - Reliever",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "ELECTRICAL SUPERVISOR",
      "count": 6,
      "department": "mep"
    },
    {
      "designation": "SENIOR ELECTRICIAN",
      "count": 18,
      "department": "mep"
    },
    {
      "designation": "JUNIOR ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "LEAD ELECTRICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "ELECTRICIAN",
      "count": 219,
      "department": "mep"
    },
    {
      "designation": "TECHNICIAN",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "SENIOR TECHNICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "JUNIOR TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "DG OPERATOR",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBING SUPERVISOR",
      "count": 5,
      "department": "mep"
    },
    {
      "designation": "SENIOR PLUMBER",
      "count": 11,
      "department": "mep"
    },
    {
      "designation": "PLUMBER",
      "count": 175,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM POOL OPERATOR",
      "count": 7,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM CARPENTER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "RELIEVER - PLUMBING",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM POOL OPERATOR & WTP OPERATOR",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "PLUMBER CUM WTP OPERATOR",
      "count": 6,
      "department": "mep"
    },
    {
      "designation": "HANDYMAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "STP CUM WTP OPERATOR",
      "count": 15,
      "department": "mep"
    },
    {
      "designation": "SENIOR STP",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "JUNIOR STP",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "STP OPERATOR",
      "count": 68,
      "department": "mep"
    },
    {
      "designation": "WTP OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "WTP/RO OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "MULTI TECHNICIAN",
      "count": 46,
      "department": "mep"
    },
    {
      "designation": "SENIOR MULTI TECHNICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "JUNIOR MULTI TECHNICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "RELIEVER - ELECTRICIAN",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "WEEKLY OFF RELIEVER",
      "count": 3,
      "department": "other"
    },
    {
      "designation": "RELIEVER CHARGES - MULTI, ELE, PLU, STP",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "MAISON",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "CARPENTER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "PAINTER",
      "count": 2,
      "department": "other"
    },
    {
      "designation": "EXECUTIVE - LIFT & PLUMBING",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "HV/AC TECHNICIAN",
      "count": 2,
      "department": "mep"
    },
    {
      "designation": "LIFE GUARD",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "FIRE ALARM TECHNICIAN",
      "count": 5,
      "department": "mep"
    },
    {
      "designation": "FIRE AND SAFETY OFFICER",
      "count": 3,
      "department": "mep"
    },
    {
      "designation": "BUGGY DRIVERS",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "MAIL ROOM",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "BMS OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "FIRE WARDEN",
      "count": 4,
      "department": "mep"
    },
    {
      "designation": "STACK OPERATOR",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "DG ENGINEER",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "POOL OPERATOR",
      "count": 55,
      "department": "mep"
    },
    {
      "designation": "SWIMMING POOL CUM WTP OPERATOR",
      "count": 7,
      "department": "mep"
    },
    {
      "designation": "WATERBODY OPERATOR",
      "count": 1,
      "department": "mep"
    },
    {
      "designation": "PEST CONTROL OPERATOR",
      "count": 47,
      "department": "other"
    },
    {
      "designation": "HK SUPERVISOR",
      "count": 65,
      "department": "housekeeping"
    },
    {
      "designation": "HK FLOOR SUPERVISOR",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "HK SUPERVISOR - JUNIOR",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "HK - FEMALE",
      "count": 572,
      "department": "housekeeping"
    },
    {
      "designation": "HK SUPERVISOR - SENIOR",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER SENIOR",
      "count": 2,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLEANER",
      "count": 569,
      "department": "housekeeping"
    },
    {
      "designation": "HK - MALE",
      "count": 177,
      "department": "housekeeping"
    },
    {
      "designation": "HK - RELIEVER",
      "count": 32,
      "department": "housekeeping"
    },
    {
      "designation": "OWC OPERATOR",
      "count": 18,
      "department": "housekeeping"
    },
    {
      "designation": "HK - COMMON AREA",
      "count": 18,
      "department": "housekeeping"
    },
    {
      "designation": "EQUIPMENTS  - HK CLEANERS",
      "count": 8,
      "department": "housekeeping"
    },
    {
      "designation": "GARBAGE COLLECTION",
      "count": 9,
      "department": "other"
    },
    {
      "designation": "GARDEN SUPERVISOR",
      "count": 17,
      "department": "garden"
    },
    {
      "designation": "HEAD GARDENER",
      "count": 4,
      "department": "garden"
    },
    {
      "designation": "SENIOR GARDENER",
      "count": 8,
      "department": "garden"
    },
    {
      "designation": "GARDENER",
      "count": 234,
      "department": "garden"
    },
    {
      "designation": "GARDEN - HELPER",
      "count": 81,
      "department": "garden"
    },
    {
      "designation": "GARDENER SPRINKLER OPERATOR",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "HORTICULTURIST",
      "count": 1,
      "department": "garden"
    },
    {
      "designation": "SECURITY OFFICER",
      "count": 5,
      "department": "security"
    },
    {
      "designation": "SECURITY EXECUTIVE",
      "count": 1,
      "department": "security"
    },
    {
      "designation": "SECURITY SUPERVISOR",
      "count": 92,
      "department": "security"
    },
    {
      "designation": "SENIOR SECURITY SUPERVISOR",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "HEAD GUARD",
      "count": 16,
      "department": "security"
    },
    {
      "designation": "LADY GUARD",
      "count": 38,
      "department": "security"
    },
    {
      "designation": "SECURITY GUARD",
      "count": 532,
      "department": "security"
    },
    {
      "designation": "JUNIOR SECURITY GUARD",
      "count": 4,
      "department": "security"
    },
    {
      "designation": "SENIOR SECURITY GUARD",
      "count": 10,
      "department": "security"
    },
    {
      "designation": "PATROLLING SECURITY GUARD",
      "count": 4,
      "department": "security"
    },
    {
      "designation": "HK CLUB HOUSE",
      "count": 12,
      "department": "housekeeping"
    },
    {
      "designation": "HK CLUB HOUSE - FEMALE",
      "count": 1,
      "department": "housekeeping"
    },
    {
      "designation": "OFFICE ASSISTANT",
      "count": 9,
      "department": "other"
    },
    {
      "designation": "OFFICE ASSISTANT CUM HK CLEANER",
      "count": 4,
      "department": "housekeeping"
    },
    {
      "designation": "PANTRY BOY",
      "count": 5,
      "department": "housekeeping"
    },
    {
      "designation": "SECURITY - RELIEVER",
      "count": 4,
      "department": "security"
    },
    {
      "designation": "KAIPOND",
      "count": 1,
      "department": "other"
    },
    {
      "designation": "GYM TRAINER",
      "count": 2,
      "department": "other"
    },
    {
      "designation": "CUSTOMER RELATIONSHIP MANAGER",
      "count": 2,
      "department": "administration"
    },
    {
      "designation": "SECURITY GUARD MAIN GATE",
      "count": 2,
      "department": "security"
    },
    {
      "designation": "LIFE  GUARD",
      "count": 1,
      "department": "security"
    }
  ]
};

export function getSiteDesignationBreakdown(siteName: string, deptKey?: 'mep' | 'housekeeping' | 'garden' | 'security' | 'administration' | 'other'): DesignationDeploymentItem[] {
  let list: DesignationDeploymentItem[] = [];
  if (!siteName || siteName === 'all' || siteName === 'All Sites') {
    list = ALL_SITES_DESIGNATION_DEPLOYMENT;
  } else {
    const target = siteName.toLowerCase().trim();
    for (const [sName, items] of Object.entries(SITE_DESIGNATION_DEPLOYMENT)) {
      const sLower = sName.toLowerCase().trim();
      if (sLower === target || sLower.includes(target) || target.includes(sLower)) {
        list = items;
        break;
      }
    }
  }
  if (deptKey) {
    return list.filter(item => item.department === deptKey);
  }
  return list;
}
