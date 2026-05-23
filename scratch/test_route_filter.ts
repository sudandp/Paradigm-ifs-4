import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import L from 'leaflet';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

// Calculate distance in meters using simple spherical law of cosines
const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

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

  console.log(`Original route points count: ${route.length}`);

  // Filter out noisy stationary points
  const filteredRoute: typeof route = [route[0]];
  let lastAdded = route[0];

  for (let i = 1; i < route.length; i++) {
      const p = route[i];
      const dist = calculateDistanceMeters(lastAdded.latitude, lastAdded.longitude, p.latitude, p.longitude);
      
      // Keep point if they moved > 40 meters, OR if it's the last point in the route
      if (dist >= 40 || i === route.length - 1) {
          filteredRoute.push(p);
          lastAdded = p;
      }
  }

  console.log(`Filtered route points count: ${filteredRoute.length}`);
  console.log("Filtered points:");
  filteredRoute.forEach((p, idx) => {
      console.log(`  Point ${idx + 1}: ${p.latitude}, ${p.longitude} at ${p.timestamp}`);
  });

  const coordsString = filteredRoute.map(p => `${p.longitude},${p.latitude}`).join(';');
  
  // Query Snapped Route
  console.log("\nQuerying OSRM with filtered points...");
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`);
    const data = await res.json();
    console.log("OSRM Response code:", data.code);
    if (data.code === 'Ok') {
      const snappedDist = data.routes[0].distance;
      console.log(`Snapped Route Distance: ${(snappedDist / 1000).toFixed(2)} KM`);
      console.log(`Snapped Route coordinates length: ${data.routes[0].geometry.coordinates.length}`);
    } else {
      console.log("OSRM Error:", data);
    }
  } catch (err: any) {
    console.error("Fetch failed:", err.message);
  }
}

test();
