import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { format } from 'date-fns';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const NEGATIVE_USERS = [
  'Shilpa M',
  'Isaac Roy',
  'Sonjoy Kurmi',
  'Venkatachalam',
  'Uma',
  'Gokul V',
  'Omkar',
  'Harish H P',
  'Joy Immanuel',
  'Ravi DEVA',
  'Sanjay Ganapati Naik',
  'Veerabhadraiah S',
  'Sandeep B',
  'Maibub Paradigm',
  'Rinju P R',
  'Sudhan M',
  'Surojit Mondal',
  'Rajeshwari',
  'Keshav Murthy',
  'Nakul R Alvar',
  'Srikanth Ks',
  'Ramesh CV',
  'Sandeep Biswas',
  'sashikanta das',
  'Siran jit Mandal',
  'Madhu NH',
  'Stany D Souza'
];

async function analyzeAll() {
    console.log("Analyzing 27 remaining users with negative DB balance...\n");

    const { data: users } = await supabase.from('users').select('*').in('name', NEGATIVE_USERS);
    const { data: leaveRequests } = await supabase.from('leave_requests').select('*').eq('leave_type', 'Comp Off').eq('status', 'approved');

    const analysisReport: any[] = [];

    for (const uName of NEGATIVE_USERS) {
        const u = users?.find(user => user.name === uName);
        if (!u) continue;

        const userLeaves = leaveRequests?.filter(l => l.user_id === u.id) || [];
        let totalTaken = 0;
        const leaveDates: string[] = [];

        userLeaves.forEach(l => {
            const s = new Date(l.start_date);
            const e = new Date(l.end_date);
            const days = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const count = l.days_count || l.total_days || (l.day_option === 'half' ? 0.5 : days);
            totalTaken += count;
            leaveDates.push(`${l.start_date}${l.start_date !== l.end_date ? ' to ' + l.end_date : ''} (${count}d: ${l.reason || 'No reason'})`);
        });

        analysisReport.push({
            name: u.name,
            email: u.email,
            role: u.role || u.role_id,
            totalTaken,
            leaveCount: userLeaves.length,
            leaveDates,
            comp_off_opening_balance: u.comp_off_opening_balance,
            comp_off_opening_date: u.comp_off_opening_date
        });
    }

    console.table(analysisReport.map(r => ({
        Name: r.name,
        Role: r.role,
        LeavesTaken: r.totalTaken,
        LeaveRequestsCount: r.leaveCount,
        OpeningBalance: r.comp_off_opening_balance
    })));
}

analyzeAll().catch(console.error);
