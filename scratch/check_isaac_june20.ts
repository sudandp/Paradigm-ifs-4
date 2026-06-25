import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { api } from '../services/api';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function inspect() {
  const { data: userData } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', '%Isaac Roy%')
    .single();

  const balance = await api.getLeaveBalancesForUser(userData.id, '2026-06-30');
  console.log('getLeaveBalancesForUser result for Isaac Roy:', {
    earnedTotal: balance.earnedTotal,
    sickTotal: balance.sickTotal,
    compOffTotal: balance.compOffTotal,
    compOffUsed: balance.compOffUsed,
    compOffPending: balance.compOffPending,
    debug: balance.debug
  });
}

inspect();
