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

  if (!route || route.length < 2) {
    console.log("No route points found.");
    return;
  }

  const coordsString = route.map(p => `${p.longitude},${p.latitude}`).join(';');
  
  // 1. Test Route Driving API
  console.log("Querying OSRM Route Driving API...");
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`);
    const data = await res.json();
    console.log("Route Driving code:", data.code);
    if (data.code === 'Ok') {
      console.log("Route Driving coordinates length:", data.routes[0].geometry.coordinates.length);
    } else {
      console.log("Route Driving error data:", data);
    }
  } catch (err: any) {
    console.error("Route Driving fetch failed:", err.message);
  }

  // 2. Test Match Driving API
  console.log("\nQuerying OSRM Match Driving API...");
  try {
    const res = await fetch(`https://router.project-osrm.org/match/v1/driving/${coordsString}?overview=full&geometries=geojson`);
    const data = await res.json();
    console.log("Match Driving code:", data.code);
    if (data.code === 'Ok') {
      console.log("Match Driving matchings count:", data.matchings.length);
      console.log("Match Driving coordinates length:", data.matchings[0].geometry.coordinates.length);
    } else {
      console.log("Match Driving error data:", data);
    }
  } catch (err: any) {
    console.error("Match Driving fetch failed:", err.message);
  }

  // 3. Test Route Foot API
  console.log("\nQuerying OSRM Route Foot API...");
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/foot/${coordsString}?overview=full&geometries=geojson`);
    const data = await res.json();
    console.log("Route Foot code:", data.code);
    if (data.code === 'Ok') {
      console.log("Route Foot coordinates length:", data.routes[0].geometry.coordinates.length);
    } else {
      console.log("Route Foot error data:", data);
    }
  } catch (err: any) {
    console.error("Route Foot fetch failed:", err.message);
  }
}

test();
