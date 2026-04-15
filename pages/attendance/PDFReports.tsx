import React from 'react';
import { Document, Page, View, Text, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';

// Register a standard font if needed, or use defaults
// Font.register({ family: 'Inter', src: '...' });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#000',
    backgroundColor: '#fff',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingBottom: 10,
    marginBottom: 20,
  },
  headerLeft: {
    width: '50%',
  },
  headerRight: {
    width: '50%',
    textAlign: 'right',
  },
  logo: {
    height: 40,
    width: 'auto',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 11,
    color: '#333',
    marginBottom: 3,
  },
  metaText: {
    fontSize: 9,
    color: '#666',
  },
  table: {
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableColHeader: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#f2f2f2',
    padding: 5,
  },
  tableCol: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 5,
  },
  tableCellHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  detailBlock: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  detailItem: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 8,
  },
  detailLabel: {
    fontSize: 8,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  detailValue: {
    fontWeight: 'bold',
    fontSize: 10,
    color: '#111827',
  },
  sectionHeader: {
    backgroundColor: '#E5E7EB',
    padding: 6,
    borderRadius: 4,
    marginBottom: 8,
    marginTop: 10,
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 10,
    color: '#374151',
    textTransform: 'uppercase',
  },
  noteBlock: {
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
    marginBottom: 8,
  },
  noteText: {
    fontSize: 9,
    color: '#92400E',
    fontStyle: 'italic',
  },
  gmcHeader: {
    borderBottomWidth: 2,
    borderBottomColor: '#006B3F',
    paddingBottom: 15,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  gmcTitle: {
    fontSize: 22,
    fontWeight: 'black',
    color: '#006B3F',
    textTransform: 'uppercase',
  },
  planBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  onboardingBorderBox: {
    borderWidth: 4,
    borderColor: '#000',
    padding: 24,
    height: '100%',
  },
  onboardingHeader: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 32,
  },
  onboardingField: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  onboardingLabel: {
    width: 180,
    fontSize: 14,
    fontWeight: 'bold',
  },
  onboardingValue: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    fontSize: 14,
    marginLeft: 8,
    paddingBottom: 2,
  },
  grid: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  gridCol: {
    flex: 1,
  },
  label: {
    fontSize: 8,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  value: {
    fontSize: 10,
    color: '#111827',
    fontWeight: 'bold',
  },
  receiptHeader: {
    borderBottomWidth: 4,
    borderBottomColor: '#006B3F',
    paddingBottom: 20,
    marginBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  receiptLogo: {
    width: 60,
    height: 60,
    backgroundColor: '#006B3F',
    padding: 10,
    borderRadius: 12,
  },
  signatureArea: {
    marginTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopStyle: 'dashed',
    borderTopColor: '#E5E7EB',
    paddingTop: 40,
  },
  signatureBox: {
    width: '40%',
    textAlign: 'center',
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    height: 40,
    marginBottom: 10,
  },
  tableCell: {
    fontSize: 9,
    textAlign: 'center',
  },
  tableCellLeft: {
    fontSize: 9,
    textAlign: 'left',
  },
  statusCell: {
    fontSize: 8,
    textAlign: 'center',
    padding: 1,
  },
  footer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    textAlign: 'center',
    fontSize: 9,
    color: '#888',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 10,
  },
  metricCard: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'column',
    gap: 2,
    minWidth: 80,
  },
  metricLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  payableDaysCard: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    minWidth: 80,
  },
  payableDaysLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#15803D',
    textTransform: 'uppercase',
  },
  payableDaysValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#166534',
  },
  attendanceBadge: {
    padding: '3 6',
    borderRadius: 4,
    fontSize: 7,
    fontWeight: 'bold',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
  },
  matrixRowLabel: {
    width: 60,
    fontSize: 7,
    fontWeight: 'bold',
    color: '#475569',
    padding: 3,
    backgroundColor: '#F8FAFC',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  matrixCell: {
    flex: 1,
    fontSize: 6.5,
    textAlign: 'center',
    padding: '3 0',
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
});

export const GMCFormReceiptDocument: React.FC<{ data: any; logoUrl?: string }> = ({ data, logoUrl }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.receiptHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
            {logoUrl ? (
              <Image src={logoUrl} style={styles.receiptLogo} />
            ) : (
              <View style={styles.receiptLogo} />
            )}
            <View>
              <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Paradigm Services</Text>
              <Text style={{ fontSize: 10, color: '#006B3F', fontWeight: 'bold', marginTop: 5 }}>CORPORATE HEALTH SERVICES</Text>
            </View>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111827' }}>GMC ENROLLMENT RECORD</Text>
            <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 5 }}>Date: {new Date().toLocaleDateString()}</Text>
            <Text style={{ fontSize: 9, color: '#9CA3AF', fontFamily: 'Courier', marginTop: 3 }}>REF: GMC-{Math.random().toString(36).substring(7).toUpperCase()}</Text>
          </View>
        </View>

        {/* Profile Grid */}
        <View style={styles.grid}>
          <View style={styles.gridCol}>
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 5, marginBottom: 15 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#006B3F' }}>EMPLOYEE PROFILE</Text>
            </View>
            <View style={{ gap: 10 }}>
              <View>
                <Text style={styles.label}>FULL NAME</Text>
                <Text style={styles.value}>{data?.employeeName}</Text>
              </View>
              <View>
                <Text style={styles.label}>EMPLOYEE ID</Text>
                <Text style={styles.value}>{data?.employeeId}</Text>
              </View>
              <View>
                <Text style={styles.label}>DESIGNATION</Text>
                <Text style={styles.value}>{data?.designation}</Text>
              </View>
              <View>
                <Text style={styles.label}>JOINING DATE</Text>
                <Text style={styles.value}>{data?.dateOfJoining}</Text>
              </View>
              <View>
                <Text style={styles.label}>COMPANY</Text>
                <Text style={styles.value}>{data?.companyName}</Text>
              </View>
              <View>
                <Text style={styles.label}>WORK SITE</Text>
                <Text style={styles.value}>{data?.siteName}</Text>
              </View>
            </View>
          </View>

          <View style={styles.gridCol}>
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 5, marginBottom: 15 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#006B3F' }}>FAMILY STRUCTURE</Text>
            </View>
            <View style={{ gap: 10 }}>
              <View>
                <Text style={styles.label}>MARITAL STATUS</Text>
                <Text style={styles.value}>{data?.maritalStatus}</Text>
              </View>
              {data?.spouseName && (
                <View>
                  <Text style={styles.label}>SPOUSE</Text>
                  <Text style={styles.value}>{data.spouseName} ({data.spouseGender})</Text>
                </View>
              )}
              <View>
                <Text style={styles.label}>NO. OF CHILDREN</Text>
                <Text style={styles.value}>{data?.children?.length || 0}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Children Details */}
        {data?.children && data.children.length > 0 && (
          <View style={{ marginTop: 30 }}>
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 5, marginBottom: 15 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#006B3F' }}>CHILDREN DETAILS</Text>
            </View>
            <View style={styles.grid}>
              {data.children.map((child: any, idx: number) => (
                <View key={idx} style={[styles.gridCol, { backgroundColor: '#F9FAFB', padding: 10, borderRadius: 8 }]}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1F2937' }}>{child.name}</Text>
                  <Text style={{ fontSize: 9, color: '#6B7280', marginTop: 2 }}>{child.gender} • DOB: {child.dob}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Policy Summary */}
        <View style={{ marginTop: 40, backgroundColor: '#ECFDF5', padding: 25, borderRadius: 15, borderWidth: 1, borderColor: '#A7F3D0' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#059669', marginBottom: 5 }}>APPROVED INSURANCE POLICY</Text>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#111827' }}>{data?.plan_name}</Text>
              <Text style={{ fontSize: 10, color: '#6B7280', marginTop: 5 }}>Group Medical Cover • Age Based Tier</Text>
            </View>
            <View style={{ textAlign: 'right' }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', marginBottom: 5 }}>TOTAL MONTHLY PREMIUM</Text>
              <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#059669' }}>₹{data?.premium_amount}</Text>
            </View>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#111827' }}>EMPLOYEE SIGNATURE</Text>
            <Text style={{ fontSize: 8, color: '#9CA3AF', marginTop: 3 }}>{data?.employeeName}</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine}>
              <Text style={{ color: '#006B3F', fontSize: 10, marginTop: 15, opacity: 0.5 }}>Paradigm Services</Text>
            </View>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#111827' }}>AUTHORIZED SIGNATORY</Text>
            <Text style={{ fontSize: 8, color: '#9CA3AF', marginTop: 3 }}>Paradigm Services HR</Text>
          </View>
        </View>

        <Text style={{ marginTop: 50, textAlign: 'center', fontSize: 8, color: '#D1D5DB', letterSpacing: 2 }}>SYSTEM GENERATED RECEIPT • NO PHYSICAL SIGNATURE REQUIRED</Text>
      </Page>
    </Document>
  );
};

export const EmployeeOnboardingDocument: React.FC<{ data: any; logoUrl?: string }> = ({ data, logoUrl }) => {
  const d = data;
  const fullName = `${d.personal.firstName} ${d.personal.middleName || ''} ${d.personal.lastName}`.replace(/\s+/g, ' ').trim();
  const fatherName = d.family.find((f: any) => f.relation === 'Father')?.name || '';
  const spouseName = d.family.find((f: any) => f.relation === 'Spouse')?.name || '';
  const motherName = d.family.find((f: any) => f.relation === 'Mother')?.name || '';

  return (
    <Document>
      {/* Page 1: Employee Personal Data */}
      <Page size="A4" style={styles.page}>
        <View style={styles.onboardingBorderBox}>
          <Text style={styles.onboardingHeader}>EMPLOYEE PERSONAL DATA</Text>
          <View style={{ width: 256, alignSelf: 'center', marginVertical: 32 }}>
            {logoUrl && <Image src={logoUrl} style={{ width: '100%' }} />}
          </View>
          <View style={{ marginTop: 'auto', gap: 15 }}>
            <View style={styles.onboardingField}>
              <Text style={styles.onboardingLabel}>EMPLOYEE'S NAME</Text>
              <Text style={styles.onboardingValue}>: {fullName}</Text>
            </View>
            <View style={styles.onboardingField}>
              <Text style={styles.onboardingLabel}>SITE</Text>
              <Text style={styles.onboardingValue}>: {d.organization.organizationName}</Text>
            </View>
            <View style={styles.onboardingField}>
              <Text style={styles.onboardingLabel}>DESIGNATION</Text>
              <Text style={styles.onboardingValue}>: {d.organization.designation}</Text>
            </View>
            <View style={styles.onboardingField}>
              <Text style={styles.onboardingLabel}>EMPLOYEE'S ID NO.</Text>
              <Text style={styles.onboardingValue}>: {d.personal.employeeId}</Text>
            </View>
            <View style={styles.onboardingField}>
              <Text style={styles.onboardingLabel}>PF No.</Text>
              <Text style={styles.onboardingValue}>: {d.uan.pfNumber || d.uan.uanNumber}</Text>
            </View>
            <View style={styles.onboardingField}>
              <Text style={styles.onboardingLabel}>ESI NO.</Text>
              <Text style={styles.onboardingValue}>: {d.esi.esiNumber}</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* Page 2: Personal Data Form */}
      <Page size="A4" style={[styles.page, { fontSize: 10 }]}>
        <View style={{ borderWidth: 2, borderColor: '#000', padding: 16, height: '100%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
             <Text style={{ fontWeight: 'bold' }}>EMPLOYEE ID No. : {d.personal.employeeId}</Text>
             <Text style={{ fontSize: 14, fontWeight: 'bold' }}>PERSONAL DATA</Text>
          </View>

          <View style={{ gap: 8 }}>
            <Text>1. Name: {fullName}</Text>
            <Text>2. Father's Name: {fatherName}</Text>
            <Text>3. Mother's Name: {motherName}</Text>
            <Text>4. Reference by: </Text>
            
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ flex: 1 }}>5. Date of Birth: {d.personal.dob}</Text>
              <Text style={{ flex: 1 }}>6. Age: {d.personal.dob ? new Date().getFullYear() - new Date(d.personal.dob).getFullYear() : ''}</Text>
            </View>

            <View style={{ flexDirection: 'row' }}>
              <Text style={{ flex: 1 }}>7. Qualification: {d.education?.[0]?.degree || ''}</Text>
              <Text style={{ flex: 1 }}>8. Experience: </Text>
            </View>

            <View style={{ flexDirection: 'row' }}>
              <Text style={{ flex: 1 }}>9. Designation: {d.organization.designation}</Text>
              <Text style={{ flex: 1 }}>10. Net Salary Offered: {d.personal.salary?.toLocaleString('en-IN')}</Text>
            </View>

            <Text>11. Present Address: {`${d.address.present.line1}, ${d.address.present.city}, ${d.address.present.state} - ${d.address.present.pincode}`}</Text>
            
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ flex: 1 }}>12. Permanent Address: {d.address.sameAsPresent ? 'Same as Present' : `${d.address.permanent.line1}, ${d.address.permanent.city}`}</Text>
              <Text style={{ flex: 1 }}>Ph. No.: {d.personal.mobile}</Text>
            </View>

            <Text>13. Left hand thumb impression</Text>
            <View style={{ flexDirection: 'row', height: 40, borderWidth: 1, borderColor: '#000' }}>
              <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: '#000' }} />
              <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: '#000' }} />
              <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: '#000' }} />
              <View style={{ flex: 1 }} />
            </View>

            <Text>14. Right hand thumb impression</Text>
            <View style={{ flexDirection: 'row', height: 40, borderWidth: 1, borderColor: '#000' }}>
              <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: '#000' }} />
              <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: '#000' }} />
              <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: '#000' }} />
              <View style={{ flex: 1 }} />
            </View>

            <View style={{ flexDirection: 'row' }}>
              <Text style={{ flex: 1 }}>15. Marital Status: {d.personal.maritalStatus}</Text>
              <Text style={{ flex: 1 }}>16. Name of the Spouse: {spouseName}</Text>
            </View>

            <View style={{ flexDirection: 'row' }}>
              <Text style={{ flex: 1 }}>18. Date of Joining: {d.organization.joiningDate}</Text>
              <Text style={{ flex: 1 }}>19. ID Card:</Text>
            </View>

            <View style={{ flexDirection: 'row' }}>
              <Text style={{ flex: 1 }}>20. ESI Number: {d.esi.esiNumber}</Text>
              <Text style={{ flex: 1 }}>21. PF Number: {d.uan.pfNumber || d.uan.uanNumber}</Text>
            </View>

            <View style={{ flexDirection: 'row' }}>
              <Text style={{ flex: 1 }}>24. Name of the Site: {d.organization.organizationName}</Text>
              <Text style={{ flex: 1 }}>25. Site / Estate Manager: </Text>
            </View>

            <Text>29. Emergency Contact Name: {d.personal.emergencyContactName} Ph.: {d.personal.emergencyContactNumber} Blood Group: {d.personal.bloodGroup}</Text>
          </View>

          <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text>Employee Signature:</Text>
            <Text>Documented by:</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export const InsuranceSummaryDocument: React.FC<{ data: any }> = ({ data }) => {
  const { personal, family, gmc } = data;
  const dependents = family.filter((f: any) => f.dependent);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 16, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0369A1' }}>Paradigm Inc.</Text>
            <Text style={{ fontSize: 12, color: '#6B7280' }}>Group Medical Insurance Plan</Text>
          </View>
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 4, marginBottom: 12 }}>Employee Details</Text>
          <View style={styles.grid}>
            <View style={styles.gridCol}><Text style={styles.label}>Employee Name:</Text><Text style={styles.value}>{personal.firstName} {personal.lastName}</Text></View>
            <View style={styles.gridCol}><Text style={styles.label}>Employee ID:</Text><Text style={styles.value}>{personal.employeeId}</Text></View>
          </View>
          <View style={styles.grid}>
            <View style={styles.gridCol}><Text style={styles.label}>Date of Birth:</Text><Text style={styles.value}>{personal.dob}</Text></View>
            <View style={styles.gridCol}><Text style={styles.label}>Gender:</Text><Text style={styles.value}>{personal.gender}</Text></View>
          </View>
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 4, marginBottom: 12 }}>Nominee Details</Text>
          <View style={styles.grid}>
            <View style={styles.gridCol}><Text style={styles.label}>Nominee Name:</Text><Text style={styles.value}>{gmc.nomineeName}</Text></View>
            <View style={styles.gridCol}><Text style={styles.label}>Relationship:</Text><Text style={styles.value}>{gmc.nomineeRelation}</Text></View>
          </View>
        </View>

        {gmc.isOptedIn && dependents.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 4, marginBottom: 12 }}>Covered Dependents</Text>
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#F9FAFB', padding: 8 }}>
              <Text style={{ flex: 2, fontSize: 10, fontWeight: 'bold' }}>Name</Text>
              <Text style={{ flex: 1, fontSize: 10, fontWeight: 'bold' }}>Relationship</Text>
              <Text style={{ flex: 1, fontSize: 10, fontWeight: 'bold' }}>Date of Birth</Text>
            </View>
            {dependents.map((dep: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', padding: 8 }}>
                <Text style={{ flex: 2, fontSize: 10 }}>{dep.name}</Text>
                <Text style={{ flex: 1, fontSize: 10 }}>{dep.relation}</Text>
                <Text style={{ flex: 1, fontSize: 10 }}>{dep.dob}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ marginTop: 40, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', textAlign: 'center' }}>
          <Text style={{ fontSize: 8, color: '#6B7280', marginBottom: 8 }}>This document confirms your enrollment in the Paradigm Inc. Group Medical Insurance plan. Please keep this for your records. This is a system-generated document and does not require a signature.</Text>
          <Text style={{ fontSize: 10, fontWeight: 'bold' }}>Policy Effective Date: {new Date().toLocaleDateString()}</Text>
        </View>
      </Page>
    </Document>
  );
};

export const InvoiceSummaryDocument: React.FC<{ invoiceData: any; calculations: any; discount: number; roundOff: number }> = ({ invoiceData, calculations, discount, roundOff }) => {
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

  return (
    <Document>
      <Page size="A4" style={[styles.page, { padding: 40, fontSize: 10 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text>Name : {invoiceData.siteName}</Text>
            <Text>Address : {invoiceData.siteAddress}</Text>
            <Text>City : {invoiceData.siteAddress.split(',').pop()?.trim()}</Text>
          </View>
          <View style={{ flex: 1, borderWidth: 1, borderColor: '#000' }}>
             <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000' }}>
               <Text style={{ flex: 1, padding: 4, borderRightWidth: 1, borderColor: '#000', fontWeight: 'bold' }}>Invoice No</Text>
               <Text style={{ flex: 1, padding: 4 }}>{invoiceData.invoiceNumber}</Text>
             </View>
             <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000' }}>
               <Text style={{ flex: 1, padding: 4, borderRightWidth: 1, borderColor: '#000', fontWeight: 'bold' }}>Date</Text>
               <Text style={{ flex: 1, padding: 4 }}>{invoiceData.invoiceDate}</Text>
             </View>
             <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000' }}>
               <Text style={{ flex: 1, padding: 4, borderRightWidth: 1, borderColor: '#000', fontWeight: 'bold' }}>Month</Text>
               <Text style={{ flex: 1, padding: 4 }}>{invoiceData.statementMonth.split('-')[0]}</Text>
             </View>
             <View style={{ flexDirection: 'row' }}>
               <Text style={{ flex: 1, padding: 4, borderRightWidth: 1, borderColor: '#000', fontWeight: 'bold' }}>Due Date</Text>
               <Text style={{ flex: 1, padding: 4 }}>{format(new Date(), 'MMMM dd, yyyy')}</Text>
             </View>
          </View>
        </View>

        <Text style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 12, textDecoration: 'underline', marginBottom: 10 }}>
          {invoiceData.siteName} Summary Statement for the month of {invoiceData.statementMonth}
        </Text>

        <View style={{ borderWidth: 1, borderColor: '#000' }}>
          <View style={{ flexDirection: 'row', backgroundColor: '#E5E7EB', fontWeight: 'bold', borderBottomWidth: 1, borderColor: '#000', padding: 4 }}>
            <Text style={{ width: 30, borderRightWidth: 1, borderColor: '#000' }}>Sl</Text>
            <Text style={{ flex: 1, borderRightWidth: 1, borderColor: '#000' }}>Description</Text>
            <Text style={{ width: 60, borderRightWidth: 1, borderColor: '#000', textAlign: 'center' }}>Deploy</Text>
            <Text style={{ width: 80, textAlign: 'right' }}>Amount(Rs)</Text>
          </View>
          {invoiceData.lineItems.map((item: any, i: number) => (
            <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000', padding: 4 }}>
              <Text style={{ width: 30, borderRightWidth: 1, borderColor: '#000' }}>{i + 1}</Text>
              <Text style={{ flex: 1, borderRightWidth: 1, borderColor: '#000' }}>{item.description}</Text>
              <Text style={{ width: 60, borderRightWidth: 1, borderColor: '#000', textAlign: 'center' }}>{item.deployment}</Text>
              <Text style={{ width: 80, textAlign: 'right' }}>{formatCurrency(item.deployment * item.ratePerMonth)}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000', padding: 4, fontWeight: 'bold' }}>
            <Text style={{ flex: 1, borderRightWidth: 1, borderColor: '#000' }}>Sub Total</Text>
            <Text style={{ width: 80, textAlign: 'right' }}>{formatCurrency(calculations.subTotal)}</Text>
          </View>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000', padding: 4 }}>
            <Text style={{ flex: 1, borderRightWidth: 1, borderColor: '#000' }}>Admin & Service Charges (10%)</Text>
            <Text style={{ width: 80, textAlign: 'right' }}>{formatCurrency(calculations.serviceCharge)}</Text>
          </View>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000', padding: 4 }}>
             <Text style={{ flex: 1, borderRightWidth: 1, borderColor: '#000' }}>Discount</Text>
             <Text style={{ width: 80, textAlign: 'right' }}>{formatCurrency(discount)}</Text>
          </View>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000', backgroundColor: '#E5E7EB', fontWeight: 'bold', padding: 4 }}>
            <Text style={{ flex: 1, borderRightWidth: 1, borderColor: '#000' }}>Grand Total</Text>
            <Text style={{ width: 80, textAlign: 'right' }}>{formatCurrency(calculations.grandTotal)}</Text>
          </View>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000', padding: 4 }}>
            <Text style={{ flex: 1, borderRightWidth: 1, borderColor: '#000' }}>CGST (9%)</Text>
            <Text style={{ width: 80, textAlign: 'right' }}>{formatCurrency(calculations.gst)}</Text>
          </View>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000', padding: 4 }}>
            <Text style={{ flex: 1, borderRightWidth: 1, borderColor: '#000' }}>SGST (9%)</Text>
            <Text style={{ width: 80, textAlign: 'right' }}>{formatCurrency(calculations.gst)}</Text>
          </View>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000', padding: 4 }}>
            <Text style={{ flex: 1, borderRightWidth: 1, borderColor: '#000' }}>Round off</Text>
            <Text style={{ width: 80, textAlign: 'right' }}>{formatCurrency(roundOff)}</Text>
          </View>
          <View style={{ flexDirection: 'row', padding: 8, backgroundColor: '#1F2937', color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>
            <Text style={{ flex: 1 }}>Payable for Services rendered</Text>
            <Text style={{ width: 120, textAlign: 'right' }}>₹{formatCurrency(calculations.finalTotal)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export const CostAnalysisDocument: React.FC<{ data: any[]; stats: any; range: string }> = ({ data, stats, range }) => {
  return (
    <Document>
      <Page size="A4" style={[styles.page, { padding: 40 }]}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>Verification Cost Analysis Report</Text>
        <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>Period: {range}</Text>

        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 30 }}>
           <View style={{ flex: 1, padding: 15, backgroundColor: '#F3F4F6', borderRadius: 8 }}>
             <Text style={{ fontSize: 10, color: '#6B7280' }}>Total Cost</Text>
             <Text style={{ fontSize: 18, fontWeight: 'bold' }}>₹{stats.totalCost.toLocaleString('en-IN')}</Text>
           </View>
           <View style={{ flex: 1, padding: 15, backgroundColor: '#F3F4F6', borderRadius: 8 }}>
             <Text style={{ fontSize: 10, color: '#6B7280' }}>Verified Employees</Text>
             <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{stats.totalEmployees}</Text>
           </View>
        </View>

        <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 10 }}>Detailed Costing</Text>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#E5E7EB', padding: 8, flexDirection: 'row', backgroundColor: '#F9FAFB' }}>
           <Text style={{ flex: 2, fontSize: 10, fontWeight: 'bold' }}>Employee</Text>
           <Text style={{ flex: 1, fontSize: 10, fontWeight: 'bold' }}>Date</Text>
           <Text style={{ flex: 2, fontSize: 10, fontWeight: 'bold' }}>Breakdown</Text>
           <Text style={{ flex: 1, fontSize: 10, fontWeight: 'bold', textAlign: 'right' }}>Total</Text>
        </View>
        {data.map((item, i) => (
          <View key={i} style={{ borderBottomWidth: 1, borderBottomColor: '#F3F4F6', padding: 8, flexDirection: 'row' }}>
             <View style={{ flex: 2 }}><Text style={{ fontSize: 10 }}>{item.employeeName}</Text><Text style={{ fontSize: 8, color: '#6B7280' }}>{item.employeeId}</Text></View>
             <Text style={{ flex: 1, fontSize: 10 }}>{item.enrollmentDate}</Text>
             <View style={{ flex: 2 }}>
               {item.breakdown.map((b: any, j: number) => (
                 <Text key={j} style={{ fontSize: 8 }}>• {b.name}: ₹{b.cost}</Text>
               ))}
             </View>
             <Text style={{ flex: 1, fontSize: 10, fontWeight: 'bold', textAlign: 'right' }}>₹{item.totalCost.toFixed(2)}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
};

export interface BasicReportDataRow {
  userName: string;
  date: string;
  status: string;
  checkIn: string;
  checkOut: string;
  duration: string;
  locationName?: string;
}

export const BasicReportDocument: React.FC<{ 
  data: BasicReportDataRow[]; 
  dateRange: { startDate: Date; endDate: Date }; 
  generatedBy?: string;
  logoUrl?: string;
}> = ({ data, dateRange, generatedBy, logoUrl }) => {
  const rowsPerPage = 18; 
  const pages: BasicReportDataRow[][] = [];
  for (let i = 0; i < data.length; i += rowsPerPage) {
    pages.push(data.slice(i, i + rowsPerPage));
  }

  return (
    <Document>
      {pages.map((pageData, pageIndex) => (
        <Page key={pageIndex} size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.header} fixed>
            <View style={styles.headerLeft}>
              {logoUrl && <Image src={logoUrl} style={styles.logo} />}
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.title}>Basic Attendance Report</Text>
              <Text style={styles.subtitle}>
                {(dateRange?.startDate && dateRange?.endDate) ? `${format(dateRange.startDate, 'dd MMM yyyy')} - ${format(dateRange.endDate, 'dd MMM yyyy')}` : 'Period Not Specified'}
              </Text>
              <Text style={styles.metaText}>
                Generated: {format(new Date(), 'dd MMM yyyy HH:mm')}
              </Text>
              {generatedBy && (
                <Text style={styles.metaText}>Generated by: {generatedBy}</Text>
              )}
            </View>
          </View>

          <View style={styles.table}>
            <View style={[styles.tableRow, { backgroundColor: '#f2f2f2' }]}>
              <View style={[styles.tableColHeader, { width: '25%' }]}><Text style={styles.tableCellHeader}>Employee Name</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>Date</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>Status</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>Punch In</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>Punch Out</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>Hours</Text></View>
            </View>
            {pageData.map((row, idx) => (
              <View key={idx} style={[styles.tableRow, { backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }]}>
                <View style={[styles.tableCol, { width: '25%' }]}><Text style={styles.tableCell}>{row.userName}</Text></View>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{row.date}</Text></View>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{row.status}</Text></View>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{row.checkIn || '-'}</Text></View>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{row.checkOut || '-'}</Text></View>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{row.duration || '-'}</Text></View>
              </View>
            ))}
          </View>

          <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
            `Paradigm Services - Confidential Report - Page ${pageNumber} of ${totalPages}`
          )} fixed />
        </Page>
      ))}
    </Document>
  );
};

export interface MonthlyReportRow {
  userName: string;
  statuses: string[];
  presentDays: number;
  halfDays: number;
  absentDays: number;
  weekOffs: number;
  holidays: number;
  weekendPresents: number;
  holidayPresents: number;
  totalPayableDays: number;
  sickLeaves: number;
  earnedLeaves: number;
  floatingHolidays: number;
  compOffs: number;
  lossOfPays: number;
  workFromHomeDays: number;
  overtimeDays: number;
}

export const MonthlyReportDocument: React.FC<{
  data: any[];
  dateRange: { startDate: Date; endDate: Date };
  generatedBy?: string;
  logoUrl?: string;
  days: Date[];
}> = ({ data, dateRange, generatedBy, logoUrl, days }) => {
  const getStatusColor = (s: string) => {
    if (s === 'P' || s === 'Present' || s === 'HP' || s === 'H/P' || s === 'W/P' || s === 'WOP') return '#059669';
    if (s === 'A' || s === 'Absent') return '#DC2626';
    if (s === 'W/O' || s === 'Weekly Off') return '#64748B';
    if (s === 'H' || s === 'Holiday') return '#4F46E5';
    if (s.includes('S/L') || s.includes('E/L') || s.includes('C/O')) return '#7C3AED';
    return '#475569';
  };

  const getStatusBg = (s: string) => {
    if (s === 'P' || s === 'Present' || s === 'HP' || s === 'H/P' || s === 'W/P' || s === 'WOP') return '#ECFDF5';
    if (s === 'A' || s === 'Absent') return '#FEF2F2';
    if (s === 'W/O' || s === 'Weekly Off') return '#F8FAFC';
    if (s === 'H' || s === 'Holiday') return '#EEF2FF';
    return '#FFFFFF';
  };

  return (
    <Document>
      {data.map((employee, empIdx) => (
        <Page key={empIdx} size="A3" orientation="landscape" style={[styles.page, { padding: '30 20' }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomWidth: 2, borderBottomColor: '#0F172A', paddingBottom: 10, marginBottom: 15 }]}>
            <View style={styles.headerLeft}>
              {logoUrl && <Image src={logoUrl} style={{ height: 40, width: 'auto', marginBottom: 4 }} />}
              <Text style={{ fontSize: 8, color: '#94A3B8', fontWeight: 'bold' }}>PARADIGM OFFICE SERVICES</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0F172A' }}>ATTENDANCE REPORT - {employee.userName || employee.employeeName}</Text>
              <Text style={{ fontSize: 10, color: '#64748B' }}>
                {format(dateRange.startDate, 'dd MMM yyyy')} - {format(dateRange.endDate, 'dd MMM yyyy')}
              </Text>
            </View>
          </View>

          {/* Employee Info & Metrics Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
            <View>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0F172A' }}>{employee.userName || employee.employeeName}</Text>
              <Text style={{ fontSize: 9, color: '#64748B' }}>Role: {employee.role?.replace(/_/g, ' ') || 'N/A'}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Net Work</Text>
                <Text style={styles.metricValue}>{(employee.totalNetWorkDuration || 0).toFixed(2)} Hrs</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Total OT</Text>
                <Text style={styles.metricValue}>{(employee.totalOT || 0).toFixed(2)} Hrs</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Avg Hrs/Day</Text>
                <Text style={styles.metricValue}>{(employee.averageWorkingHrs || 0).toFixed(2)} Hrs</Text>
              </View>
              <View style={styles.payableDaysCard}>
                <Text style={styles.payableDaysLabel}>Payable Days</Text>
                <Text style={styles.payableDaysValue}>{employee.totalPayableDays}</Text>
              </View>
            </View>
          </View>

          {/* Attendance Distribution */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 15, flexWrap: 'wrap' }}>
            <View style={[styles.attendanceBadge, { backgroundColor: '#ECFDF5', borderColor: '#10B981', color: '#065F46' }]}>
              <Text>Present {employee.presentDays}</Text>
            </View>
            <View style={[styles.attendanceBadge, { backgroundColor: '#FEF2F2', borderColor: '#EF4444', color: '#991B1B' }]}>
              <Text>Absent {employee.absentDays}</Text>
            </View>
            <View style={[styles.attendanceBadge, { backgroundColor: '#F8FAFC', borderColor: '#94A3B8', color: '#1E293B' }]}>
              <Text>W/O {employee.weekOffs}</Text>
            </View>
            <View style={[styles.attendanceBadge, { backgroundColor: '#EEF2FF', borderColor: '#6366F1', color: '#3730A3' }]}>
              <Text>Holiday {employee.holidays}</Text>
            </View>
            <View style={[styles.attendanceBadge, { backgroundColor: '#F5F3FF', borderColor: '#8B5CF6', color: '#4C1D95' }]}>
              <Text>Leave {employee.leaves}</Text>
            </View>
            {employee.lossOfPays > 0 && (
              <View style={[styles.attendanceBadge, { backgroundColor: '#FFF1F2', borderColor: '#F43F5E', color: '#881337' }]}>
                <Text>LOP {employee.lossOfPays}</Text>
              </View>
            )}
          </View>

          {/* Detailed Matrix Table */}
          <View style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
            {/* Table Header - Day Numbers */}
            <View style={{ flexDirection: 'row', backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
              <View style={[styles.matrixRowLabel, { backgroundColor: '#F1F5F9' }]}><Text>Date</Text></View>
              {days.map((d, i) => (
                <View key={i} style={styles.matrixCell}><Text style={{ fontWeight: 'bold' }}>{format(d, 'd')}</Text></View>
              ))}
            </View>

            {/* Row: Status */}
            <View style={{ flexDirection: 'row' }}>
              <View style={styles.matrixRowLabel}><Text>Status</Text></View>
              {employee.dailyData?.map((d: any, i: number) => (
                <View key={i} style={[styles.matrixCell, { backgroundColor: getStatusBg(d.status) }]}>
                  <Text style={{ color: getStatusColor(d.status), fontWeight: 'bold' }}>{d.status}</Text>
                </View>
              )) || days.map((_, i) => <View key={i} style={styles.matrixCell}><Text>-</Text></View>)}
            </View>

            {/* Row: In Time */}
            <View style={{ flexDirection: 'row' }}>
              <View style={styles.matrixRowLabel}><Text>In Time</Text></View>
              {employee.dailyData?.map((d: any, i: number) => (
                <View key={i} style={styles.matrixCell}><Text>{d.inTime || '-'}</Text></View>
              )) || days.map((_, i) => <View key={i} style={styles.matrixCell}><Text>-</Text></View>)}
            </View>

            {/* Row: Out Time */}
            <View style={{ flexDirection: 'row' }}>
              <View style={styles.matrixRowLabel}><Text>Out Time</Text></View>
              {employee.dailyData?.map((d: any, i: number) => (
                <View key={i} style={styles.matrixCell}><Text>{d.outTime || '-'}</Text></View>
              )) || days.map((_, i) => <View key={i} style={styles.matrixCell}><Text>-</Text></View>)}
            </View>

            {/* Row: Gross Dur */}
            <View style={{ flexDirection: 'row' }}>
              <View style={styles.matrixRowLabel}><Text>Gross Dur</Text></View>
              {employee.dailyData?.map((d: any, i: number) => (
                <View key={i} style={styles.matrixCell}><Text>{d.grossDuration || '-'}</Text></View>
              )) || days.map((_, i) => <View key={i} style={styles.matrixCell}><Text>-</Text></View>)}
            </View>

            {/* Row: Net Worked */}
            <View style={{ flexDirection: 'row' }}>
              <View style={styles.matrixRowLabel}><Text>Net Worked</Text></View>
              {employee.dailyData?.map((d: any, i: number) => (
                <View key={i} style={styles.matrixCell}><Text style={{ fontWeight: 'bold' }}>{d.netWorkedHours || '-'}</Text></View>
              )) || days.map((_, i) => <View key={i} style={styles.matrixCell}><Text>-</Text></View>)}
            </View>

            {/* Row: OT */}
            <View style={{ flexDirection: 'row' }}>
              <View style={styles.matrixRowLabel}><Text>OT</Text></View>
              {employee.dailyData?.map((d: any, i: number) => (
                <View key={i} style={styles.matrixCell}><Text style={{ color: d.ot && d.ot !== '-' ? '#2563EB' : '#64748B' }}>{d.ot || '-'}</Text></View>
              )) || days.map((_, i) => <View key={i} style={styles.matrixCell}><Text>-</Text></View>)}
            </View>

            {/* Row: Shift */}
            <View style={{ flexDirection: 'row' }}>
              <View style={[styles.matrixRowLabel, { borderBottomWidth: 0 }]}><Text>Shift</Text></View>
              {employee.dailyData?.map((d: any, i: number) => (
                <View key={i} style={[styles.matrixCell, { borderBottomWidth: 0 }]}><Text>{d.shift || '-'}</Text></View>
              )) || days.map((_, i) => <View key={i} style={[styles.matrixCell, { borderBottomWidth: 0 }]}><Text>-</Text></View>)}
            </View>
          </View>

          {/* Footer Metadata */}
          <View style={{ marginTop: 15, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 }}>
            <View style={{ flexDirection: 'row', gap: 15 }}>
              <Text style={{ fontSize: 7, color: '#94A3B8' }}>AVG WORKING HOURS: {employee.averageWorkingHrs?.toFixed(1) || 0}H</Text>
              <Text style={{ fontSize: 7, color: '#94A3B8' }}>GENERATED BY: {generatedBy?.toUpperCase() || 'SYSTEM'}</Text>
            </View>
            <Text style={{ fontSize: 7, color: '#94A3B8' }}>Page {empIdx + 1} of {data.length}</Text>
          </View>
        </Page>
      ))}
    </Document>
  );
};

export const FieldReportDocument: React.FC<{
  report: any;
  template: any;
  logoUrl?: string;
}> = ({ report, template, logoUrl }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.gmcHeader}>
          <View>
            <Text style={styles.gmcTitle}>Field Report</Text>
            <Text style={styles.metaText}>Paradigm Office Services • Digital Audit Record</Text>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#006B3F' }}>ID: {report.id.substring(0, 8).toUpperCase()}</Text>
            <Text style={styles.metaText}>Date: {format(new Date(report.createdAt), 'PPPP')}</Text>
          </View>
        </View>

        <View style={styles.detailBlock}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Submitter</Text>
            <Text style={styles.detailValue}>{report.userName}</Text>
            <Text style={styles.metaText}>Visit: {format(new Date(report.visitStartTime), 'HH:mm')} - {format(new Date(report.visitEndTime), 'HH:mm')}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Site Context</Text>
            <Text style={styles.detailValue}>{report.siteName}</Text>
            <Text style={styles.metaText}>{report.jobType} | {report.assetArea}</Text>
          </View>
        </View>

        <Text style={[styles.title, { fontSize: 14, marginBottom: 10, borderLeft: '4 solid #006B3F', paddingLeft: 10 }]}>Checklist Summary</Text>

        {template?.sections.map((section: any) => (
          <View key={section.id} wrap={false} style={{ marginBottom: 15 }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            {section.items.map((item: any) => {
              const resp = report.responses[item.id];
              const isNo = resp?.value === 'No';
              const isYes = resp?.value === 'Yes';
              const color = isNo ? '#DC2626' : isYes ? '#059669' : '#6B7280';
              const bg = isNo ? '#FEF2F2' : isYes ? '#ECFDF5' : '#F9FAFB';

              return (
                <View key={item.id} style={{ marginBottom: 5 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 5 }}>
                    <Text style={{ fontSize: 10, color: '#4B5563', flex: 1 }}>{item.label}</Text>
                    <View style={{ backgroundColor: bg, padding: '2 6', borderRadius: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: 'bold', color: color }}>{String(resp?.value || 'N/A').toUpperCase()}</Text>
                    </View>
                  </View>
                  {resp?.remarks && (
                    <View style={styles.noteBlock}>
                      <Text style={styles.noteText}><Text style={{ fontWeight: 'bold' }}>Note:</Text> {resp.remarks}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        <View wrap={false} style={{ marginTop: 20 }}>
          <Text style={[styles.title, { fontSize: 14, marginBottom: 10, borderLeft: '4 solid #006B3F', paddingLeft: 10 }]}>Management Review</Text>
          <View style={[styles.detailItem, { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB' }]}>
            <Text style={{ fontSize: 11, lineHeight: 1.5, color: '#374151' }}>{report.summary}</Text>
            {report.userRemarks && (
              <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#D1D5DB', borderTopStyle: 'dashed' }}>
                <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#006B3F', textTransform: 'uppercase' }}>Staff Final Remarks</Text>
                <Text style={{ fontSize: 10, color: '#111827', marginTop: 3 }}>{report.userRemarks}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
          `Paradigm Services - Field Report - Page ${pageNumber} of ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
};

export const GMCSubmissionDocument: React.FC<{
  sub: any;
}> = ({ sub }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.gmcHeader}>
          <View>
            <Text style={styles.gmcTitle}>GMC Enrollment Receipt</Text>
            <Text style={styles.metaText}>PARADIGM SERVICES - SECURE SUBMISSION</Text>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text style={styles.metaText}>SUBMISSION ID</Text>
            <Text style={{ fontSize: 12, fontWeight: 'bold' }}>#{sub.id.substring(0, 8).toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.detailBlock}>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailLabel}>Member Identity</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
               <View style={{ width: '100%', marginBottom: 5 }}>
                  <Text style={styles.metaText}>FULL NAME</Text>
                  <Text style={{ fontSize: 14, fontWeight: 'bold' }}>{sub.employeeName}</Text>
               </View>
               <View style={{ width: '45%' }}>
                  <Text style={styles.metaText}>EMPLOYEE ID</Text>
                  <Text style={styles.detailValue}>{sub.employeeId}</Text>
               </View>
               <View style={{ width: '45%' }}>
                  <Text style={styles.metaText}>DESIGNATION</Text>
                  <Text style={styles.detailValue}>{sub.designation}</Text>
               </View>
               <View style={{ width: '45%' }}>
                  <Text style={styles.metaText}>DOB</Text>
                  <Text style={styles.detailValue}>{sub.dob}</Text>
               </View>
               <View style={{ width: '45%' }}>
                  <Text style={styles.metaText}>GENDER</Text>
                  <Text style={styles.detailValue}>{sub.gender}</Text>
               </View>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailLabel}>Assignment Details</Text>
            <View style={{ gap: 8 }}>
               <View>
                  <Text style={styles.metaText}>COMPANY/ORG</Text>
                  <Text style={{ fontSize: 14, fontWeight: 'bold' }}>{sub.companyName}</Text>
               </View>
               <View>
                  <Text style={styles.metaText}>PRIMARY SITE</Text>
                  <Text style={{ fontSize: 14, fontWeight: 'bold' }}>{sub.siteName}</Text>
               </View>
               <View>
                  <Text style={styles.metaText}>MARITAL STATUS</Text>
                  <Text style={styles.detailValue}>{sub.maritalStatus}</Text>
               </View>
            </View>
          </View>
        </View>

        <View style={styles.planBox}>
          <View>
            <Text style={[styles.metaText, { color: '#006B3F' }]}>COVERAGE TIER</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#006B3F' }}>{sub.planName}</Text>
          </View>
          <View style={{ borderLeftWidth: 1, borderLeftColor: '#006B3F', paddingLeft: 20, flex: 1, marginLeft: 20 }}>
            <Text style={styles.metaText}>MONTHLY PREMIUM</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>₹{sub.premiumAmount}</Text>
          </View>
        </View>

        {(sub.maritalStatus === 'Married' || (sub.children && sub.children.length > 0)) && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.detailLabel}>Family Declarations</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, { backgroundColor: '#f2f2f2' }]}>
                <View style={[styles.tableColHeader, { flex: 1 }]}><Text style={styles.tableCellHeader}>Relation</Text></View>
                <View style={[styles.tableColHeader, { flex: 2 }]}><Text style={styles.tableCellHeader}>Name</Text></View>
                <View style={[styles.tableColHeader, { flex: 1 }]}><Text style={styles.tableCellHeader}>DOB</Text></View>
              </View>
              {sub.maritalStatus === 'Married' && sub.spouseName && (
                <View style={styles.tableRow}>
                  <View style={[styles.tableCol, { flex: 1 }]}><Text style={styles.tableCell}>Spouse</Text></View>
                  <View style={[styles.tableCol, { flex: 2 }]}><Text style={styles.tableCell}>{sub.spouseName} ({sub.spouseGender})</Text></View>
                  <View style={[styles.tableCol, { flex: 1 }]}><Text style={styles.tableCell}>{sub.spouseDob}</Text></View>
                </View>
              )}
              {sub.children?.map((child: any, idx: number) => (
                <View key={idx} style={styles.tableRow}>
                  <View style={[styles.tableCol, { flex: 1 }]}><Text style={styles.tableCell}>Child {idx + 1}</Text></View>
                  <View style={[styles.tableCol, { flex: 2 }]}><Text style={styles.tableCell}>{child.name} ({child.gender})</Text></View>
                  <View style={[styles.tableCol, { flex: 1 }]}><Text style={styles.tableCell}>{child.dob}</Text></View>
                </View>
              ))}
            </View>
          </View>
        )}

        {(sub.fatherName || sub.motherName) && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.detailLabel}>Parental Declarations</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
               {sub.fatherName && (
                 <View style={[styles.detailItem, { backgroundColor: '#F9FAFB' }]}>
                    <Text style={styles.metaText}>FATHER'S NAME</Text>
                    <Text style={styles.detailValue}>{sub.fatherName} ({sub.fatherGender})</Text>
                    <Text style={styles.metaText}>DOB: {sub.fatherDob || '—'}</Text>
                 </View>
               )}
               {sub.motherName && (
                 <View style={[styles.detailItem, { backgroundColor: '#F9FAFB' }]}>
                    <Text style={styles.metaText}>MOTHER'S NAME</Text>
                    <Text style={styles.detailValue}>{sub.motherName} ({sub.motherGender})</Text>
                    <Text style={styles.metaText}>DOB: {sub.motherDob || '—'}</Text>
                 </View>
               )}
            </View>
          </View>
        )}

        <View style={{ marginTop: 'auto', textAlign: 'center', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 20 }}>
          <Text style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 5 }}>Verified Enrollment Receipt • Digitally Generated</Text>
          <Text style={{ fontSize: 8, color: '#9CA3AF' }}>Submission ID: {sub.id}</Text>
        </View>
      </Page>
    </Document>
  );
};
export interface SiteOtDataRow {
  userName: string;
  date: string;
  siteOtIn: string | null;
  siteOtOut: string | null;
  duration: string | null;
  locationName?: string;
}

export const SiteOtReportDocument: React.FC<{ 
  data: SiteOtDataRow[]; 
  dateRange: { startDate: Date; endDate: Date }; 
  generatedBy?: string;
  logoUrl?: string;
}> = ({ data, dateRange, generatedBy, logoUrl }) => {
  const rowsPerPage = 18;
  const pages: SiteOtDataRow[][] = [];
  for (let i = 0; i < data.length; i += rowsPerPage) {
    pages.push(data.slice(i, i + rowsPerPage));
  }

  return (
    <Document>
      {pages.map((pageData, pageIndex) => (
        <Page key={pageIndex} size="A4" orientation="landscape" style={styles.page}>
          {/* Header */}
          <View style={styles.header} fixed>
            <View style={styles.headerLeft}>
              {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.title}>Site OT Attendance Report</Text>
              <Text style={styles.subtitle}>
                {(dateRange?.startDate && dateRange?.endDate) ? `${format(dateRange.startDate, 'dd MMM yyyy')} - ${format(dateRange.endDate, 'dd MMM yyyy')}` : 'Period Not Specified'}
              </Text>
              <Text style={styles.metaText}>
                Generated: {format(new Date(), 'dd MMM yyyy HH:mm')}
              </Text>
              {generatedBy && (
                <Text style={styles.metaText}>Generated by: {generatedBy}</Text>
              )}
            </View>
          </View>

          {/* Table */}
          <View style={styles.table}>
            <View style={[styles.tableRow, { backgroundColor: '#f2f2f2' }]}>
              <View style={[styles.tableColHeader, { width: '25%' }]}><Text style={styles.tableCellHeader}>Employee Name</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>Date</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>Site OT In</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>Site OT Out</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>Duration</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>Location</Text></View>
            </View>
            {pageData.map((row, idx) => (
              <View key={idx} style={[styles.tableRow, { backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }]}>
                <View style={[styles.tableCol, { width: '25%' }]}><Text style={styles.tableCell}>{row.userName}</Text></View>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{format(new Date(row.date.replace(/-/g, '/')), 'dd MMM yyyy')}</Text></View>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{row.siteOtIn || '-'}</Text></View>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{row.siteOtOut || '-'}</Text></View>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{row.duration || '-'}</Text></View>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{row.locationName || '-'}</Text></View>
              </View>
            ))}
          </View>

          {/* Footer */}
          <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
            `Paradigm Services - Confidential Report - Page ${pageNumber} of ${totalPages}`
          )} fixed />
        </Page>
      ))}
    </Document>
  );
};

export interface AttendanceLogDataRow {
  userName: string;
  date: string;
  time: string;
  type: string;
  locationName: string;
  device?: string;
  photoUrl?: string;
}

export const AttendanceLogDocument: React.FC<{
  data: AttendanceLogDataRow[];
  dateRange: { startDate: Date; endDate: Date };
  generatedBy?: string;
  logoUrl?: string;
}> = ({ data, dateRange, generatedBy, logoUrl }) => {
  const rowsPerPage = 22;
  const pages: AttendanceLogDataRow[][] = [];
  for (let i = 0; i < data.length; i += rowsPerPage) {
    pages.push(data.slice(i, i + rowsPerPage));
  }

  return (
    <Document>
      {pages.map((pageData, pageIndex) => (
        <Page key={pageIndex} size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.header} fixed>
            <View style={styles.headerLeft}>
              {logoUrl && <Image src={logoUrl} style={styles.logo} />}
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.title}>Detailed Attendance Log</Text>
              <Text style={styles.subtitle}>
                {(dateRange?.startDate && dateRange?.endDate) ? `${format(dateRange.startDate, 'dd MMM yyyy')} - ${format(dateRange.endDate, 'dd MMM yyyy')}` : 'Period Not Specified'}
              </Text>
              <Text style={styles.metaText}>Generated: {format(new Date(), 'dd MMM yyyy HH:mm')}</Text>
              {generatedBy && <Text style={styles.metaText}>By: {generatedBy}</Text>}
            </View>
          </View>

          <View style={styles.table}>
            <View style={[styles.tableRow, { backgroundColor: '#f2f2f2' }]}>
              <View style={[styles.tableColHeader, { width: '20%' }]}><Text style={styles.tableCellHeader}>Employee</Text></View>
              <View style={[styles.tableColHeader, { width: '12%' }]}><Text style={styles.tableCellHeader}>Date</Text></View>
              <View style={[styles.tableColHeader, { width: '10%' }]}><Text style={styles.tableCellHeader}>Time</Text></View>
              <View style={[styles.tableColHeader, { width: '10%' }]}><Text style={styles.tableCellHeader}>Type</Text></View>
              <View style={[styles.tableColHeader, { width: '28%' }]}><Text style={styles.tableCellHeader}>Location</Text></View>
              <View style={[styles.tableColHeader, { width: '20%' }]}><Text style={styles.tableCellHeader}>Device Info</Text></View>
            </View>
            {pageData.map((row, idx) => (
              <View key={idx} style={[styles.tableRow, { backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }]}>
                <View style={[styles.tableCol, { width: '20%' }]}><Text style={styles.tableCellLeft}>{row.userName}</Text></View>
                <View style={[styles.tableCol, { width: '12%' }]}><Text style={styles.tableCell}>{row.date}</Text></View>
                <View style={[styles.tableCol, { width: '10%' }]}><Text style={styles.tableCell}>{row.time}</Text></View>
                <View style={[styles.tableCol, { width: '10%' }]}><Text style={[styles.tableCell, { fontWeight: 'bold' }]}>{row.type.toUpperCase()}</Text></View>
                <View style={[styles.tableCol, { width: '28%' }]}><Text style={styles.tableCellLeft}>{row.locationName}</Text></View>
                <View style={[styles.tableCol, { width: '20%' }]}><Text style={styles.tableCell}>{row.device || '-'}</Text></View>
              </View>
            ))}
          </View>

          <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
            `Paradigm Services - Detailed Logs - Page ${pageNumber} of ${totalPages}`
          )} fixed />
        </Page>
      ))}
    </Document>
  );
};

export interface WorkHoursReportDataRow {
  userName: string;
  department: string;
  totalDays: number;
  presentDays: number;
  totalWorkingHours: number;
  avgWorkingHours: number;
  otHours: number;
}

export const WorkHoursReportDocument: React.FC<{
  data: WorkHoursReportDataRow[];
  dateRange: { startDate: Date; endDate: Date };
  generatedBy?: string;
  logoUrl?: string;
}> = ({ data, dateRange, generatedBy, logoUrl }) => {
  const rowsPerPage = 20;
  const pages: WorkHoursReportDataRow[][] = [];
  for (let i = 0; i < data.length; i += rowsPerPage) {
    pages.push(data.slice(i, i + rowsPerPage));
  }

  return (
    <Document>
      {pages.map((pageData, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          <View style={styles.header} fixed>
            <View style={styles.headerLeft}>
              {logoUrl && <Image src={logoUrl} style={styles.logo} />}
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.title}>Monthly Work Hours Report</Text>
              <Text style={styles.subtitle}>
                {(dateRange?.startDate && dateRange?.endDate) ? `${format(dateRange.startDate, 'dd MMM yyyy')} - ${format(dateRange.endDate, 'dd MMM yyyy')}` : 'Period Not Specified'}
              </Text>
              <Text style={styles.metaText}>Generated: {format(new Date(), 'dd MMM yyyy HH:mm')}</Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={[styles.tableRow, { backgroundColor: '#f2f2f2' }]}>
              <View style={[styles.tableColHeader, { width: '25%' }]}><Text style={styles.tableCellHeader}>Employee</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>Dept</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>P-Days</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>Total Hrs</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>Avg Hrs</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>OT Hrs</Text></View>
            </View>
            {pageData.map((row, idx) => (
              <View key={idx} style={[styles.tableRow, { backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }]}>
                <View style={[styles.tableCol, { width: '25%' }]}><Text style={styles.tableCellLeft}>{row.userName}</Text></View>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{row.department}</Text></View>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{row.presentDays}</Text></View>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{row.totalWorkingHours.toFixed(1)}h</Text></View>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{row.avgWorkingHours.toFixed(1)}h</Text></View>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{row.otHours.toFixed(1)}h</Text></View>
              </View>
            ))}
          </View>

          <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
            `Paradigm Services - Productivity Report - Page ${pageNumber} of ${totalPages}`
          )} fixed />
        </Page>
      ))}
    </Document>
  );
};

export interface AuditLogDataRow {
  dateTime: string;
  action: string;
  performer_name: string;
  target_name: string;
  detailsStr: string;
}

export const AuditLogDocument: React.FC<{ 
  data: AuditLogDataRow[]; 
  dateRange: { startDate: Date; endDate: Date }; 
  generatedBy?: string;
  logoUrl?: string;
}> = ({ data, dateRange, generatedBy, logoUrl }) => {
  const rowsPerPage = 15;
  const pages: AuditLogDataRow[][] = [];
  for (let i = 0; i < data.length; i += rowsPerPage) {
    pages.push(data.slice(i, i + rowsPerPage));
  }

  return (
    <Document>
      {pages.map((pageData, pageIndex) => (
        <Page key={pageIndex} size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.header} fixed>
            <View style={styles.headerLeft}>
              {logoUrl && <Image src={logoUrl} style={styles.logo} />}
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.title}>Audit Log Report</Text>
              <Text style={styles.subtitle}>
                {(dateRange?.startDate && dateRange?.endDate) ? `${format(dateRange.startDate, 'dd MMM yyyy')} - ${format(dateRange.endDate, 'dd MMM yyyy')}` : 'Period Not Specified'}
              </Text>
              <Text style={styles.metaText}>
                Generated: {format(new Date(), 'dd MMM yyyy HH:mm')}
              </Text>
              {generatedBy && (
                <Text style={styles.metaText}>Generated by: {generatedBy}</Text>
              )}
            </View>
          </View>

          <View style={styles.table}>
            <View style={[styles.tableRow, { backgroundColor: '#f2f2f2' }]}>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>Date & Time</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>Action</Text></View>
              <View style={[styles.tableColHeader, { width: '20%' }]}><Text style={styles.tableCellHeader}>Performed By</Text></View>
              <View style={[styles.tableColHeader, { width: '20%' }]}><Text style={styles.tableCellHeader}>Target Employee</Text></View>
              <View style={[styles.tableColHeader, { width: '30%' }]}><Text style={styles.tableCellHeader}>Details</Text></View>
            </View>
            {pageData.map((row, idx) => (
              <View key={idx} style={[styles.tableRow, { backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }]}>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{row.dateTime}</Text></View>
                <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{row.action}</Text></View>
                <View style={[styles.tableCol, { width: '20%' }]}><Text style={styles.tableCell}>{row.performer_name}</Text></View>
                <View style={[styles.tableCol, { width: '20%' }]}><Text style={styles.tableCell}>{row.target_name}</Text></View>
                <View style={[styles.tableCol, { width: '30%' }]}><Text style={styles.tableCell}>{row.detailsStr}</Text></View>
              </View>
            ))}
          </View>

          <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
            `Paradigm Services - Audit Report - Page ${pageNumber} of ${totalPages}`
          )} fixed />
        </Page>
      ))}
    </Document>
  );
};
