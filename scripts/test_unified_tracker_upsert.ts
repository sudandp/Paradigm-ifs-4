import { api } from '../services/api';
import { supabase } from '../services/supabase';

async function runTests() {
  console.log('--- STARTING UNIFIED TRACKER SINGLE & BULK SYNC TEST ---');

  // Test 1: Verify getSiteInvoiceRecords attaches billingMonth
  console.log('Test 1: Fetching records and verifying billingMonth property...');
  const records = await api.getSiteInvoiceRecords();
  console.log(`Fetched ${records.length} records.`);
  if (records.length > 0) {
    const sample = records[0];
    if (!sample.billingMonth || !sample.billingMonth.match(/^\d{4}-\d{2}-01$/)) {
      throw new Error(`Sample record missing valid billingMonth: ${sample.billingMonth}`);
    }
    console.log(`✓ Test 1 Passed: Sample record has valid billingMonth: ${sample.billingMonth}`);
  }

  // Test 2: Verify non-destructive field merge behavior
  console.log('Test 2: Verifying bulkSaveSiteInvoiceRecords non-destructive merge logic...');
  const testSiteName = 'Automated Test Site ' + Date.now();
  const testMonth = '2026-06-01';

  // Step 2a: Save initial record simulating Ops Manager punch
  const opsRecord = await api.saveSiteInvoiceRecord({
    siteName: testSiteName,
    companyName: 'PIFS',
    billingCycle: '1st Billing Cycle',
    opsIncharge: 'Sandeep B',
    opsRemarks: 'Initial Ops Punch for June',
    managerTentativeDate: '2026-06-30',
    managerReceivedDate: '2026-07-02',
    billingMonth: testMonth,
  });
  console.log(`Created test record with ID: ${opsRecord.id}`);

  // Step 2b: Simulate Finance Accountant performing a bulk import for the same site & month
  // The finance import contains invoicePreparedDate, invoiceSentDate, financeRemarks,
  // but leaves managerTentativeDate and opsRemarks blank!
  const bulkResult = await api.bulkSaveSiteInvoiceRecords([
    {
      siteName: testSiteName,
      companyName: 'PIFS',
      invoiceIncharge: 'Arpitha Nair',
      financeRemarks: 'Finance invoice prepared and sent',
      invoicePreparedDate: '2026-07-05',
      invoiceSentDate: '2026-07-05',
      billingMonth: testMonth,
    }
  ]);
  console.log(`Bulk sync result: updated=${bulkResult.updatedCount}, created=${bulkResult.createdCount}`);
  if (bulkResult.updatedCount !== 1 || bulkResult.createdCount !== 0) {
    throw new Error(`Expected exactly 1 update and 0 created, got: ${JSON.stringify(bulkResult)}`);
  }

  // Step 2c: Query the updated record to verify Ops dates were NOT wiped out
  const { data: verifyRaw } = await supabase
    .from('site_invoice_tracker')
    .select('*')
    .eq('id', opsRecord.id)
    .single();

  if (!verifyRaw) throw new Error('Test record not found in database');

  console.log('Merged record in database:');
  console.log(`- ops_remarks: "${verifyRaw.ops_remarks}" (Expected preserved: "Initial Ops Punch for June")`);
  console.log(`- manager_tentative_date: "${verifyRaw.manager_tentative_date}" (Expected preserved: "2026-06-30")`);
  console.log(`- manager_received_date: "${verifyRaw.manager_received_date}" (Expected preserved: "2026-07-02")`);
  console.log(`- finance_remarks: "${verifyRaw.finance_remarks}" (Expected updated)`);
  console.log(`- invoice_sent_date: "${verifyRaw.invoice_sent_date}" (Expected updated)`);

  if (verifyRaw.ops_remarks !== 'Initial Ops Punch for June') {
    throw new Error('Ops remarks were unexpectedly overwritten!');
  }
  if (verifyRaw.manager_tentative_date !== '2026-06-30') {
    throw new Error('Manager tentative date was unexpectedly overwritten!');
  }
  if (verifyRaw.invoice_sent_date !== '2026-07-05') {
    throw new Error('Finance invoice sent date was not updated!');
  }
  console.log('✓ Test 2 Passed: Bulk import merged non-destructively without wiping counterpart data!');

  // Test 3: Test single entry save for the same site & month without ID (intelligent deduplication)
  console.log('Test 3: Verifying single entry saveSiteInvoiceRecord deduplication without ID...');
  const singleUpdate = await api.saveSiteInvoiceRecord({
    siteName: testSiteName,
    hrIncharge: 'Chandana R',
    hrRemarks: 'HR approved punches',
    hrReceivedDate: '2026-07-03',
    billingMonth: testMonth,
  });

  if (singleUpdate.id !== opsRecord.id) {
    throw new Error(`Expected single save to update existing ID ${opsRecord.id}, but got ID ${singleUpdate.id}`);
  }

  const { data: verifySingle } = await supabase
    .from('site_invoice_tracker')
    .select('*')
    .eq('id', opsRecord.id)
    .single();

  if (verifySingle.hr_remarks !== 'HR approved punches') {
    throw new Error('HR remarks were not updated!');
  }
  if (verifySingle.ops_remarks !== 'Initial Ops Punch for June') {
    throw new Error('Ops remarks were lost during single update!');
  }
  if (verifySingle.invoice_sent_date !== '2026-07-05') {
    throw new Error('Finance remarks were lost during single update!');
  }
  console.log('✓ Test 3 Passed: Single entry save correctly detected existing entry and merged across all departments!');

  // Cleanup: Delete the test record
  console.log('Cleaning up test record...');
  await supabase.from('site_invoice_tracker').delete().eq('id', opsRecord.id);
  console.log('✓ Cleanup complete.');

  console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
