import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function test() {
  const userId = '3535b1fa-8055-4d91-b832-3cf492045033';
  const { data: route } = await supabase
    .from('route_history')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', '2026-05-23T00:00:00Z')
    .lte('timestamp', '2026-05-23T23:59:59Z')
    .order('timestamp', { ascending: true });

  if (!route || route.length < 2) return;

  const coordsString = route.map(p => `${p.longitude},${p.latitude}`).join(';');
  
  // 1. Fetch Driving Route
  const resD = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`);
  const dataD = await resD.json();
  const distD = dataD.routes[0].distance; // meters
  
  // 2. Fetch Foot Route
  const resF = await fetch(`https://router.project-osrm.org/route/v1/foot/${coordsString}?overview=full&geometries=geojson`);
  const dataF = await resF.json();
  const distF = dataF.routes[0].distance; // meters

  console.log(`Driving Route Distance: ${(distD / 1000).toFixed(2)} KM`);
  console.log(`Foot Route Distance: ${(distF / 1000).toFixed(2)} KM`);
}

test();
