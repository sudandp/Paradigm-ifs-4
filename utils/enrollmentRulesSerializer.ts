import type { EnrollmentRules, DocumentRules, VerificationRules } from '../types';

export const defaultDesignationRules: {
  documents: DocumentRules;
  verifications: VerificationRules;
} = {
  documents: {
    photo: true,
    aadhaar: true,
    pan: true,
    bankProof: true,
    educationCertificate: false,
    salarySlip: false,
    uanProof: false,
    familyAadhaar: false,
  },
  verifications: {
    requireBengaluruAddress: false,
    requireDobVerification: false,
    requireBankNameMatch: false,
    requireUanVerification: false,
  }
};

export const emptyEnrollmentRules: EnrollmentRules = {
  esiCtcThreshold: 21000,
  enforceManpowerLimit: false,
  manpowerLimitRule: 'warn',
  allowSalaryEdit: false,
  salaryThreshold: 21000,
  defaultPolicySingle: '1L',
  defaultPolicyMarried: '2L',
  enableEsiRule: false,
  enableGmcRule: false,
  enforceFamilyValidation: true,
  requireDigitalSignature: false,
  requireOfficerAttestation: false,
  requireBookletReview: false,
  maxFamilyDependents: 5,
  rulesByDesignation: {
    'Default (All Roles)': defaultDesignationRules,
    'Security Guard': {
      documents: {
        photo: true,
        aadhaar: true,
        pan: true,
        bankProof: true,
        educationCertificate: false,
        salarySlip: false,
        uanProof: false,
        familyAadhaar: false,
      },
      verifications: {
        requireBengaluruAddress: false,
        requireDobVerification: true,
        requireBankNameMatch: true,
        requireUanVerification: false,
      }
    }
  },
};

/**
 * Serializes typed EnrollmentRules (camelCase) to DB format (dual snake_case & camelCase)
 * ensuring designation keys (e.g. "Security Guard") are preserved without mutation.
 */
export const serializeEnrollmentRules = (rules: EnrollmentRules): Record<string, any> => {
  const rulesByDesig: Record<string, any> = {};
  if (rules.rulesByDesignation) {
    Object.entries(rules.rulesByDesignation).forEach(([desig, config]) => {
      if (!config || typeof config !== 'object') return;
      rulesByDesig[desig] = {
        documents: {
          photo: !!config.documents?.photo,
          aadhaar: !!config.documents?.aadhaar,
          pan: !!config.documents?.pan,
          bank_proof: !!config.documents?.bankProof,
          bankProof: !!config.documents?.bankProof,
          education_certificate: !!config.documents?.educationCertificate,
          educationCertificate: !!config.documents?.educationCertificate,
          salary_slip: !!config.documents?.salarySlip,
          salarySlip: !!config.documents?.salarySlip,
          uan_proof: !!config.documents?.uanProof,
          uanProof: !!config.documents?.uanProof,
          family_aadhaar: !!config.documents?.familyAadhaar,
          familyAadhaar: !!config.documents?.familyAadhaar,
        },
        verifications: {
          require_bengaluru_address: !!config.verifications?.requireBengaluruAddress,
          requireBengaluruAddress: !!config.verifications?.requireBengaluruAddress,
          require_dob_verification: !!config.verifications?.requireDobVerification,
          requireDobVerification: !!config.verifications?.requireDobVerification,
          require_bank_name_match: !!config.verifications?.requireBankNameMatch,
          requireBankNameMatch: !!config.verifications?.requireBankNameMatch,
          require_uan_verification: !!config.verifications?.requireUanVerification,
          requireUanVerification: !!config.verifications?.requireUanVerification,
        }
      };
    });
  }

  return {
    esi_ctc_threshold: rules.esiCtcThreshold ?? 21000,
    esiCtcThreshold: rules.esiCtcThreshold ?? 21000,
    enforce_manpower_limit: !!rules.enforceManpowerLimit,
    enforceManpowerLimit: !!rules.enforceManpowerLimit,
    manpower_limit_rule: rules.manpowerLimitRule ?? 'warn',
    manpowerLimitRule: rules.manpowerLimitRule ?? 'warn',
    allow_salary_edit: !!rules.allowSalaryEdit,
    allowSalaryEdit: !!rules.allowSalaryEdit,
    salary_threshold: rules.salaryThreshold ?? 21000,
    salaryThreshold: rules.salaryThreshold ?? 21000,
    default_policy_single: rules.defaultPolicySingle ?? '1L',
    defaultPolicySingle: rules.defaultPolicySingle ?? '1L',
    default_policy_married: rules.defaultPolicyMarried ?? '2L',
    defaultPolicyMarried: rules.defaultPolicyMarried ?? '2L',
    enable_esi_rule: !!rules.enableEsiRule,
    enableEsiRule: !!rules.enableEsiRule,
    enable_gmc_rule: !!rules.enableGmcRule,
    enableGmcRule: !!rules.enableGmcRule,
    enforce_family_validation: rules.enforceFamilyValidation ?? true,
    enforceFamilyValidation: rules.enforceFamilyValidation ?? true,
    require_digital_signature: !!rules.requireDigitalSignature,
    requireDigitalSignature: !!rules.requireDigitalSignature,
    require_officer_attestation: !!rules.requireOfficerAttestation,
    requireOfficerAttestation: !!rules.requireOfficerAttestation,
    require_booklet_review: !!rules.requireBookletReview,
    requireBookletReview: !!rules.requireBookletReview,
    max_family_dependents: rules.maxFamilyDependents ?? 5,
    maxFamilyDependents: rules.maxFamilyDependents ?? 5,
    rules_by_designation: rulesByDesig,
    rulesByDesignation: rulesByDesig,
  };
};

/**
 * Deserializes database record (either snake_case or camelCase) into typed EnrollmentRules.
 */
export const deserializeEnrollmentRules = (raw: any): EnrollmentRules => {
  if (!raw || typeof raw !== 'object') return emptyEnrollmentRules;

  const rawByDesig = raw.rules_by_designation || raw.rulesByDesignation || {};
  const rulesByDesignation: Record<string, { documents: DocumentRules; verifications: VerificationRules }> = {};

  Object.entries(rawByDesig).forEach(([desig, config]: [string, any]) => {
    if (!config || typeof config !== 'object') return;
    const docs = config.documents || {};
    const verifs = config.verifications || {};

    const cleanConfig = {
      documents: {
        photo: docs.photo ?? true,
        aadhaar: docs.aadhaar ?? true,
        pan: docs.pan ?? true,
        bankProof: docs.bankProof ?? docs.bank_proof ?? true,
        educationCertificate: docs.educationCertificate ?? docs.education_certificate ?? false,
        salarySlip: docs.salarySlip ?? docs.salary_slip ?? false,
        uanProof: docs.uanProof ?? docs.uan_proof ?? false,
        familyAadhaar: docs.familyAadhaar ?? docs.family_aadhaar ?? false,
      },
      verifications: {
        requireBengaluruAddress: verifs.requireBengaluruAddress ?? verifs.require_bengaluru_address ?? false,
        requireDobVerification: verifs.requireDobVerification ?? verifs.require_dob_verification ?? false,
        requireBankNameMatch: verifs.requireBankNameMatch ?? verifs.require_bank_name_match ?? false,
        requireUanVerification: verifs.requireUanVerification ?? verifs.require_uan_verification ?? false,
      }
    };

    rulesByDesignation[desig] = cleanConfig;
    // Also store lower-case and title-cased keys for instantaneous fuzzy matching
    rulesByDesignation[desig.toLowerCase()] = cleanConfig;
  });

  if (!rulesByDesignation['Default (All Roles)']) {
    rulesByDesignation['Default (All Roles)'] = defaultDesignationRules;
  }

  return {
    esiCtcThreshold: Number(raw.esiCtcThreshold ?? raw.esi_ctc_threshold ?? 21000),
    enforceManpowerLimit: Boolean(raw.enforceManpowerLimit ?? raw.enforce_manpower_limit ?? false),
    manpowerLimitRule: (raw.manpowerLimitRule ?? raw.manpower_limit_rule ?? 'warn') as 'warn' | 'block',
    allowSalaryEdit: Boolean(raw.allowSalaryEdit ?? raw.allow_salary_edit ?? false),
    salaryThreshold: Number(raw.salaryThreshold ?? raw.salary_threshold ?? 21000),
    defaultPolicySingle: (raw.defaultPolicySingle ?? raw.default_policy_single ?? '1L') as '1L' | '2L',
    defaultPolicyMarried: (raw.defaultPolicyMarried ?? raw.default_policy_married ?? '2L') as '1L' | '2L',
    enableEsiRule: Boolean(raw.enableEsiRule ?? raw.enable_esi_rule ?? false),
    enableGmcRule: Boolean(raw.enableGmcRule ?? raw.enable_gmc_rule ?? false),
    enforceFamilyValidation: Boolean(raw.enforceFamilyValidation ?? raw.enforce_family_validation ?? true),
    requireDigitalSignature: Boolean(raw.requireDigitalSignature ?? raw.require_digital_signature ?? false),
    requireOfficerAttestation: Boolean(raw.requireOfficerAttestation ?? raw.require_officer_attestation ?? false),
    requireBookletReview: Boolean(raw.requireBookletReview ?? raw.require_booklet_review ?? false),
    maxFamilyDependents: Number(raw.maxFamilyDependents ?? raw.max_family_dependents ?? 5),
    rulesByDesignation,
  };
};
