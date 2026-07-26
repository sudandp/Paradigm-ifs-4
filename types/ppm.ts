export type PPMCategory = 
  | 'HT_YARD' 
  | 'GENERATOR' 
  | 'ELECTRICAL_PANEL' 
  | 'WTP' 
  | 'RO' 
  | 'STP' 
  | 'SP' 
  | 'BOOSTER_PUMPS';

export type PPMFrequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | 'NONE';

export type PPMSeverity = 'CRITICAL' | 'MAJOR' | 'MEDIUM' | 'MINOR' | 'OK' | 'NA';

export type PPMInputType = 'TEXT' | 'NUMBER' | 'DATE' | 'YES_NO' | 'OPTIONS';

export interface PPMCriterionTemplate {
  id: string;
  label: string;
  inputType: PPMInputType;
  options?: string[]; // for OPTIONS type
  unit?: string; // e.g., 'Amps', 'bar'
}

export interface PPMCheckPointTemplate {
  id: string;
  sequenceNumber?: number; // e.g. 1, 2, 3
  label: string;
  frequency: PPMFrequency;
  criteria: PPMCriterionTemplate[];
}

export interface PPMSubEquipmentType {
  id: string;
  name: string;
  defaultCheckPoints: PPMCheckPointTemplate[];
}

export interface PPMSectionTemplate {
  id: string;
  title: string;
  description?: string;
  checkPoints: PPMCheckPointTemplate[];
  repeatable?: boolean; // For pump/panel instances
  subEquipmentType?: PPMSubEquipmentType;
}

export interface PPMCategoryTemplate {
  id: PPMCategory;
  name: string;
  sections: PPMSectionTemplate[];
}

export type PPMAuditStatus = 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'REVIEWED';

export interface PPMAuditHeader {
  id: string;
  siteName: string;
  referenceNumber: string;
  categoryId: PPMCategory;
  auditDate: string;
  clientDivision: string;
  status: PPMAuditStatus;
  auditorName: string;
}

// Holds the observation against a specific criterion
export interface PPMObservation {
  id: string;
  auditId: string;
  sectionInstanceId: string; // e.g., 'electrical-panels-main' or 'pump-1'
  checkPointId: string;
  criterionId: string;
  value: string | number | boolean;
  severity: PPMSeverity;
  photoUrl?: string;
  remarks?: string;
  updatedAt: string;
}

export interface PPMSummaryCounts {
  critical: number;
  major: number;
  medium: number;
  minor: number;
  total: number;
}
