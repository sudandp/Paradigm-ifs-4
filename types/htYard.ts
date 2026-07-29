// HT Yard Electrical Audit Module Types

export type HTAuditStatus = 'Draft' | 'Submitted' | 'Under_Review' | 'Approved' | 'Sent_Back';

export type HTEquipmentModuleType = 
  | 'RMU'
  | 'Switchgear'
  | 'HT_Panel'
  | 'Meter_Cubicle'
  | 'VCB'
  | 'Transformer'
  | 'CSS'
  | 'LT_Kiosk';

export interface HTAuditHeader {
  id: string;
  organizationId?: string;
  siteId?: string;
  siteName: string;
  locationAddress?: string;
  gpsCoordinates?: { lat: number; lng: number };
  clientDivision?: string;
  referenceNumber: string;
  auditDate: string;
  auditorId?: string;
  auditorName?: string;
  status: HTAuditStatus;
  hiraChecklist?: HTHIRAPoint[];
  htYardCommonPoints?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface HTEquipmentInstance {
  id: string;
  auditId: string;
  moduleType: HTEquipmentModuleType;
  instanceName: string; // e.g. "RMU 1"
  instanceNumber: number;
  feederWayCount: number;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface HTAuditResponse {
  id?: string;
  auditId: string;
  equipmentInstanceId?: string; // null if site-wide point
  moduleType: string;
  sectionKey: string;
  itemNumber: number;
  fieldKey: string;
  fieldLabel: string;
  responseValue?: string;
  remarks?: string;
  photoUrls?: string[];
  isNotApplicable?: boolean;
  updatedAt?: string;
}

export type SnagStatus = 'Open' | 'In_Progress' | 'Closed';

export interface HTSnagItem {
  id: string;
  auditId: string;
  equipmentInstanceId?: string;
  itemNumber?: number;
  snagPoint: string;
  actionSuggested: string;
  photoUrl?: string;
  assignedTo?: string;
  assignedToName?: string;
  targetDate?: string;
  completedDate?: string;
  status: SnagStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type HTMasterCategory = 'Cable Details' | 'RMUMD' | 'TRMaster Data' | 'LTKMD' | 'HTYardCommon' | (string & {});

export interface HTMasterOption {
  id: string;
  category: HTMasterCategory;
  manufacturer?: string;
  fieldKey: string;
  optionValue: string;
  isActive: boolean;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HTHIRAPoint {
  itemNumber: number;
  checkPoint: string;
  auditCriteria: string;
  observation?: string;
  photoUrls?: string[];
}

export interface FieldSpec {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'searchable_select' | 'cascading_select' | 'boolean' | 'sub_fields' | 'repeater';
  optionsCategory?: HTMasterCategory;
  optionsFieldKey?: string;
  isManufacturerField?: boolean;
  subFields?: FieldSpec[];
}

export interface SectionSpec {
  sectionKey: string;
  title: string;
  fields: FieldSpec[];
}

export interface ModuleSpec {
  moduleType: HTEquipmentModuleType | 'HT_Yard_Common' | 'Earth_Pit';
  title: string;
  description: string;
  repeatsPerSite: boolean;
  sections: SectionSpec[];
}
