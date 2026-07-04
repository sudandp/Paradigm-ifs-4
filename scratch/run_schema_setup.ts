import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const sql = `
-- 1. Create route_history Table if not exists
CREATE TABLE IF NOT EXISTS public.route_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  battery_level NUMERIC,
  device_name TEXT,
  ip_address TEXT,
  network_type TEXT,
  network_provider TEXT,
  source TEXT,
  request_id TEXT
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_route_history_user_time ON public.route_history(user_id, timestamp DESC);

-- Enable RLS
ALTER TABLE public.route_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can insert their own route points" ON public.route_history;
CREATE POLICY "Users can insert their own route points" 
ON public.route_history FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own route points" ON public.route_history;
CREATE POLICY "Users can view their own route points" 
ON public.route_history FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Managers and Admin can view all route points" ON public.route_history;
CREATE POLICY "Managers and Admin can view all route points" 
ON public.route_history FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND role_id IN ('admin', 'management', 'reporting_manager', 'hr')
  )
);


-- 2. Create travel_logs Table (matching travelEngine.ts expected columns)
CREATE TABLE IF NOT EXISTS public.travel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  travel_date DATE NOT NULL,
  vehicle_type TEXT,
  total_km NUMERIC(10, 3) DEFAULT 0.0,
  deduction_km NUMERIC(10, 3) DEFAULT 0.0,
  reimbursable_km NUMERIC(10, 3) DEFAULT 0.0,
  per_km_rate NUMERIC(10, 2) DEFAULT 0.0,
  gross_amount NUMERIC(10, 2) DEFAULT 0.0,
  net_amount NUMERIC(10, 2) DEFAULT 0.0,
  raw_km NUMERIC(10, 3) DEFAULT 0.0,
  validated_km NUMERIC(10, 3),
  computation_log TEXT[],
  status TEXT DEFAULT 'computed',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_travel_date UNIQUE (user_id, travel_date)
);

-- Enable RLS for travel_logs
ALTER TABLE public.travel_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own travel logs" ON public.travel_logs;
CREATE POLICY "Users can view their own travel logs" 
ON public.travel_logs FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Managers can manage travel logs" ON public.travel_logs;
CREATE POLICY "Managers can manage travel logs" 
ON public.travel_logs FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND role_id IN ('admin', 'management', 'reporting_manager', 'hr')
  )
);
`;

async function runSQL(rpcName: string, params: any): Promise<boolean> {
  console.log(`Trying RPC: ${rpcName}`);
  try {
    const { data, error } = await supabase.rpc(rpcName, params);
    if (error) {
      console.log(`  RPC ${rpcName} failed:`, error.message);
      return false;
    }
    console.log(`  RPC ${rpcName} SUCCEEDED!`);
    return true;
  } catch (err: any) {
    console.log(`  RPC ${rpcName} threw exception:`, err.message || err);
    return false;
  }
}

async function run() {
  const strategies = [
    { name: 'execute_sql', params: { sql } },
    { name: 'execute_sql', params: { sql_query: sql } },
    { name: 'exec_sql', params: { sql } },
    { name: 'exec_sql', params: { sql_query: sql } },
    { name: 'exec_sql', params: { query: sql } },
    { name: 'run_sql', params: { sql } },
    { name: 'run_sql', params: { sql_query: sql } }
  ];

  let success = false;
  for (const strategy of strategies) {
    const result = await runSQL(strategy.name, strategy.params);
    if (result) {
      success = true;
      break;
    }
  }

  if (success) {
    console.log("SQL Schema Applied Successfully!");
  } else {
    console.error("Failed to run SQL schema through all RPC methods. Please execute the SQL manually in Supabase dashboard SQL editor.");
  }
}

run();
