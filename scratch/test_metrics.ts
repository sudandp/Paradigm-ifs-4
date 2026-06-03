import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Import dynamically to ensure env vars are set before supabase client is initialized
const { fetchTodayMetrics, fetchAttendanceSummary, fetchTopPerformers } = await import('../services/attendanceDashboard.js');

async function test() {
  console.log('Testing fetchTodayMetrics (with fallback)...');
  try {
    const metrics = await fetchTodayMetrics();
    console.log('fetchTodayMetrics Success:', metrics);
  } catch (err) {
    console.error('fetchTodayMetrics failed:', err);
  }

  console.log('\nTesting fetchAttendanceSummary (with fallback)...');
  try {
    const summary = await fetchAttendanceSummary(new Date('2026-06-01'), new Date('2026-06-03'));
    console.log('fetchAttendanceSummary Success count:', summary.length);
    if (summary.length > 0) console.log('First summary row:', summary[0]);
  } catch (err) {
    console.error('fetchAttendanceSummary failed:', err);
  }

  console.log('\nTesting fetchTopPerformers (with fallback)...');
  try {
    const performers = await fetchTopPerformers(new Date('2026-06-01'), new Date('2026-06-03'));
    console.log('fetchTopPerformers Success:', performers);
  } catch (err) {
    console.error('fetchTopPerformers failed:', err);
  }
}

test().catch(console.error);
