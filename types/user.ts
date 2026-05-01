import { UploadedFile } from './common';

export type UserRole = string;

export interface Role {
  id: string;
  displayName: string;
  permissions?: Permission[];
}

export type Permission =
  | 'view_all_submissions'
  | 'manage_users'
  | 'manage_sites'
  | 'view_entity_management'
  | 'view_developer_settings'
  | 'view_operations_dashboard'
  | 'view_site_dashboard'
  | 'create_enrollment'
  | 'manage_roles_and_permissions'
  | 'manage_attendance_rules'
  | 'view_own_attendance'
  | 'view_all_attendance'
  | 'apply_for_leave'
  | 'manage_leave_requests'
  | 'manage_approval_workflow'
  | 'download_attendance_report'
  | 'manage_tasks'
  | 'manage_policies'
  | 'manage_insurance'
  | 'manage_enrollment_rules'
  | 'manage_uniforms'
  | 'view_invoice_summary'
  | 'view_verification_costing'
  | 'view_field_staff_tracking'
  | 'manage_modules'
  | 'access_support_desk'
  | 'view_my_team'
  | 'view_field_reports'
  | 'manage_biometric_devices'
  | 'manage_geo_locations'
  | 'view_my_locations'
  | 'view_profile'
  | 'view_mobile_nav_home'
  | 'view_mobile_nav_attendance'
  | 'view_mobile_nav_tasks'
  | 'view_mobile_nav_profile'
  | 'manage_finance_settings'
  | 'view_finance_reports'
  | 'view_attendance_tracker'
  | 'view_crm'
  | 'view_crm_pipeline'
  | 'view_crm_checklists'
  | 'view_operations'
  | 'view_referrals';

export interface TaskGroup {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  role: string; // Display name for UI
  roleId: string; // UUID from database
  organizationId?: string;
  organizationName?: string;
  reportingManagerId?: string;
  reportingManager2Id?: string;
  reportingManager3Id?: string;
  photoUrl?: string;
  biometricId?: string;

  /**
   * Computed property used by some UI screens to indicate whether the
   * user is currently checked in (available) or not.  This field is
   * optional because most API calls do not include availability by
   * default.
   */
  isAvailable?: boolean;
  
  // Salary hold fields for violation enforcement
  salaryHold?: boolean;
  salaryHoldReason?: string | null;
  salaryHoldDate?: string | null; // ISO String
  earnedLeaveOpeningBalance?: number;
  earnedLeaveOpeningDate?: string; // YYYY-MM-DD
  sickLeaveOpeningBalance?: number;
  sickLeaveOpeningDate?: string; // YYYY-MM-DD
  compOffOpeningBalance?: number;
  compOffOpeningDate?: string; // YYYY-MM-DD
  floatingLeaveOpeningBalance?: number;
  floatingLeaveOpeningDate?: string; // YYYY-MM-DD
  otHoursBank?: number;
  monthlyOtHours?: number;
  childCareLeaveOpeningBalance?: number;
  childCareLeaveOpeningDate?: string; // YYYY-MM-DD
  joiningDate?: string; // YYYY-MM-DD
  /**
   * Optional human-readable location name for proximity logic.
   */
  locationName?: string;
  /**
   * Flag indicating if the user is considered "nearby" the current user.
   */
  isNearby?: boolean;
  /**
   * Flag indicating if the user is a team member (direct/indirect report) of the viewer.
   */
  isTeamMember?: boolean;
  location?: string;
  societyId?: string;
  societyName?: string;
  locationId?: string;
  passcode?: string;
}

export interface UserChild {
  id: string;
  userId: string;
  childName: string;
  dateOfBirth: string; // YYYY-MM-DD
  birthCertificateUrl?: string | null;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PersonalDetails {
  employeeId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other' | '';
  maritalStatus: 'Single' | 'Married' | 'Divorced' | 'Widowed' | '';
  bloodGroup: '' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  mobile: string;
  alternateMobile?: string;
  email: string;
  idProofType?: 'Aadhaar' | 'PAN' | 'Voter ID' | '';
  idProofNumber?: string;
  photo?: UploadedFile | null;
  idProofFront?: UploadedFile | null;
  idProofBack?: UploadedFile | null;
  emergencyContactName: string;
  emergencyContactNumber: string;
  relationship: 'Spouse' | 'Child' | 'Father' | 'Mother' | 'Sibling' | 'Other' | '';
  salary: number | null;
  verifiedStatus?: {
    name?: boolean | null;
    dob?: boolean | null;
    idProofNumber?: boolean | null;
    email?: boolean | null;
  };
  isQrVerified?: boolean;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  verifiedStatus?: {
    line1?: boolean | null;
    city?: boolean | null;
    state?: boolean | null;
    pincode?: boolean | null;
    country?: boolean | null;
  };
}

export interface AddressDetails {
  present: Address;
  permanent: Address;
  sameAsPresent: boolean;
}

export interface FamilyMember {
  id: string;
  relation: 'Spouse' | 'Child' | 'Father' | 'Mother' | '';
  name: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other' | '';
  occupation?: string;
  dependent: boolean;
  idProof: UploadedFile | null;
  phone?: string;
}

export interface EducationRecord {
  id: string;
  degree: string;
  institution: string;
  startYear: string;
  endYear: string;
  percentage?: number | null;
  grade?: string;
  document?: UploadedFile | null;
}

export interface BankDetails {
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName: string;
  bankProof?: UploadedFile | null;
  verifiedStatus?: {
    accountHolderName?: boolean | null;
    accountNumber?: boolean | null;
    ifscCode?: boolean | null;
  };
}

export interface UanDetails {
  uanNumber?: string;
  pfNumber?: string;
  hasPreviousPf: boolean;
  document?: UploadedFile | null;
  salarySlip?: UploadedFile | null;
  verifiedStatus?: {
    uanNumber?: boolean | null;
  };
}

export interface EsiDetails {
  esiNumber?: string;
  esiRegistrationDate?: string;
  esicBranch?: string;
  hasEsi: boolean;
  document?: UploadedFile | null;
  verifiedStatus?: {
    esiNumber?: boolean | null;
  };
}

export interface GmcDetails {
  isOptedIn: boolean | null;
  policyAmount?: '1L' | '2L' | '';
  nomineeName?: string;
  nomineeRelation?: 'Spouse' | 'Child' | 'Father' | 'Mother' | '';
  wantsToAddDependents?: boolean;
  selectedSpouseId?: string;
  selectedChildIds?: string[];
  gmcPolicyCopy?: UploadedFile | null;
  declarationAccepted?: boolean;
  optOutReason?: string;
  alternateInsuranceProvider?: string;
  alternateInsuranceStartDate?: string;
  alternateInsuranceEndDate?: string;
  alternateInsuranceCoverage?: string;
}

export interface OrganizationDetails {
  designation: string;
  department: string;
  reportingManager: string;
  organizationId: string;
  organizationName: string;
  joiningDate: string;
  workType: 'Full-time' | 'Part-time' | 'Contract' | '';
  site?: string;
  defaultSalary?: number | null;
}

export interface EmployeeUniformSelection {
  itemId: string; // From UniformItem.id
  itemName: string; // From UniformItem.name
  sizeId: string; // From MasterGents/LadiesUniforms.pants/shirts[].id
  sizeLabel: string; // e.g., "32" or "L"
  fit: string; // e.g., "Regular Fit"
  quantity: number;
}

export interface SalaryChangeRequest {
  id: string;
  onboardingId: string;
  employeeName: string;
  siteName: string;
  requestedBy: string; // userId
  requestedByName: string;
  requestedAt: string; // ISO string
  originalAmount: number;
  requestedAmount: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approvedBy?: string; // userId
  approvedAt?: string;
  rejectionReason?: string;
}

export interface Fingerprints {
  leftThumb: UploadedFile | null;
  leftIndex: UploadedFile | null;
  leftMiddle: UploadedFile | null;
  leftRing: UploadedFile | null;
  leftLittle: UploadedFile | null;
  rightThumb: UploadedFile | null;
  rightIndex: UploadedFile | null;
  rightMiddle: UploadedFile | null;
  rightRing: UploadedFile | null;
  rightLittle: UploadedFile | null;
}

export interface BiometricsData {
  signatureImage: UploadedFile | null;
  fingerprints: Fingerprints;
}
