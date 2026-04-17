const fs = require('fs');
const path = require('path');

const typesDir = path.join(__dirname, '../types');
const indexPath = path.join(typesDir, 'index.ts');

let content = fs.readFileSync(indexPath, 'utf-8');

// Categories map
const files = {
  'user.ts': ['UserRole', 'Role', 'Permission', 'TaskGroup', 'User', 'UserChild', 'PersonalDetails', 'Address', 'AddressDetails', 'FamilyMember', 'EducationRecord', 'BankDetails', 'UanDetails', 'EsiDetails', 'GmcDetails', 'OrganizationDetails', 'EmployeeUniformSelection', 'SalaryChangeRequest', 'Fingerprints', 'BiometricsData'],
  'organization.ts': ['Organization', 'OrganizationGroup', 'Company', 'Entity', 'SiteConfiguration', 'RegistrationType', 'CompanyEmail', 'ComplianceCodes', 'ComplianceDocument', 'CompanyHoliday', 'CompanyInsurance', 'SiteInsurance', 'SitePolicy', 'CompanyPolicy', 'InsuranceType', 'Insurance', 'HolidayListItem', 'ToolListItem', 'SimDetail', 'IssuedEquipment', 'InsurancePolicyDetails', 'SiteInsuranceStatus', 'IssuedTool', 'Agreement'],
  'onboarding.ts': ['OnboardingData', 'OnboardingStep', 'DocumentRules', 'VerificationRules', 'EnrollmentRules'],
  'attendance.ts': ['AttendanceEventType', 'AttendanceEvent', 'RoutePoint', 'Location', 'RecurringHolidayRule', 'StaffAttendanceRules', 'SiteShiftDefinition', 'UserHoliday', 'AttendanceSettings', 'Holiday', 'AttendanceViolation', 'AttendanceUnlockRequest', 'ViolationReset', 'FieldAttendanceViolation', 'GeofencingSettings', 'DailyAttendanceStatus', 'DailyAttendanceRecord', 'LeaveType', 'LeaveRequestStatus', 'ApprovalRecord', 'CompOffLog', 'LeaveBalance', 'CorrectionDetails', 'LeaveRequest', 'ExtraWorkLog'],
  'settings.ts': ['EmailSettings', 'SiteManagementSettings', 'AddressSettings', 'GmcPolicySettings', 'OtpSettings', 'BackupSchedule', 'ApiSettings', 'NotificationSettings', 'EmailConfig', 'EmailTemplate', 'EmailScheduleRule', 'EmailLog', 'AttendanceReportType', 'ReportEmailPayload'],
  // Devices, tasks, etc...
};

// We will write a smart logic to pull exported interfaces/types
const exportedBlocks = [];
const regex = /export *(interface|type) *([A-Za-z0-9_]+)[\s\S]*?(?=\nexport *(?:interface|type|const|function)|\n\/\*|\n\/\/ ==|$)/g;

let match;
while ((match = regex.exec(content)) !== null) {
  exportedBlocks.push({
    full: match[0].trim(),
    type: match[1],
    name: match[2]
  });
}

const unmapped = [];
const mappedContent = {};

exportedBlocks.forEach(block => {
  let matchedFile = null;
  for (const [file, names] of Object.entries(files)) {
    if (names.includes(block.name)) {
      matchedFile = file;
      break;
    }
  }
  
  if (matchedFile) {
    if (!mappedContent[matchedFile]) mappedContent[matchedFile] = [];
    mappedContent[matchedFile].push(block.full);
  } else {
    unmapped.push(block.full);
  }
});

// Write to files
for (const [file, blocks] of Object.entries(mappedContent)) {
  fs.writeFileSync(path.join(typesDir, file), blocks.join('\n\n') + '\n');
}

// Write the new index.ts
let newIndex = `// Auto-generated barrel file\n\n`;
for (const file of Object.keys(mappedContent)) {
  newIndex += `export * from './${file.replace('.ts', '')}';\n`;
}

if (unmapped.length > 0) {
  newIndex += `\n// Unmapped legacy types\n\n` + unmapped.join('\n\n') + '\n';
}

fs.writeFileSync(indexPath, newIndex);
console.log('Types split successfully!');
console.log('Unmapped types retained in index.ts:', unmapped.length);
