import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Fallback sites if sites table has no coordinates
const DEFAULT_MONITORED_SITES = [
  { name: 'Pune (Head Office Cluster)', lat: 18.5204, lon: 73.8567 },
  { name: 'Mumbai (Site Cluster)', lat: 19.0760, lon: 72.8777 },
  { name: 'Bengaluru (Tech Park)', lat: 12.9716, lon: 77.5946 },
  { name: 'Delhi NCR Hub', lat: 28.6139, lon: 77.2090 },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow manual invocation or cron trigger
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase credentials missing on environment' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Fetch sites with coordinates from Supabase, or fall back to default clusters
    let monitoredLocations = [...DEFAULT_MONITORED_SITES];

    try {
      const { data: dbSites } = await supabase
        .from('locations')
        .select('id, name, latitude, longitude')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(20);

      if (dbSites && dbSites.length > 0) {
        monitoredLocations = dbSites.map((s) => ({
          name: s.name,
          lat: parseFloat(s.latitude),
          lon: parseFloat(s.longitude),
          siteId: s.id,
        }));
      }
    } catch {
      // Use defaults if sites query fails
    }

    const results: any[] = [];
    const now = new Date();
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

    for (const loc of monitoredLocations) {
      try {
        // 2. Fetch Open-Meteo forecast (Zero Cost, No API Key)
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
          `&hourly=precipitation_probability,precipitation,weather_code,wind_speed_10m` +
          `&timezone=auto&forecast_days=1`;

        const weatherRes = await fetch(weatherUrl);
        if (!weatherRes.ok) continue;

        const weatherData = await weatherRes.json();
        const hourlyTimes: string[] = weatherData.hourly?.time || [];

        // Check next 2 hours
        const next2Hours = hourlyTimes
          .map((t, idx) => ({
            time: new Date(t),
            prob: weatherData.hourly?.precipitation_probability?.[idx] ?? 0,
            mm: weatherData.hourly?.precipitation?.[idx] ?? 0,
            wind: weatherData.hourly?.wind_speed_10m?.[idx] ?? 0,
          }))
          .filter((h) => h.time > now && h.time.getTime() - now.getTime() <= 2.5 * 3600 * 1000);

        if (next2Hours.length === 0) continue;

        const maxRainProb = Math.max(...next2Hours.map((h) => h.prob));
        const maxWind = Math.max(...next2Hours.map((h) => h.wind));

        // 3. Evaluate Threshold: Rain >= 65% or Wind >= 38 km/h
        if (maxRainProb >= 65 || maxWind >= 38) {
          const isCritical = maxRainProb >= 85 || maxWind >= 45;
          const severity = isCritical ? 'CRITICAL' : 'HIGH';
          const alertType = maxRainProb >= 65 ? (isCritical ? 'HEAVY_DOWNPOUR' : 'RAIN_IMMIGRANT') : 'HIGH_WIND';

          // Anti-Spam Check: Don't trigger if already alerted in the last 2 hours for this location
          const { data: existingAlerts } = await supabase
            .from('weather_alerts')
            .select('id')
            .eq('city_name', loc.name)
            .gte('created_at', twoHoursAgo)
            .limit(1);

          if (existingAlerts && existingAlerts.length > 0) {
            results.push({
              location: loc.name,
              status: 'THROTTLED',
              reason: 'Alert already dispatched within the last 2 hours',
            });
            continue;
          }

          // 4. Insert into weather_alerts
          const title = isCritical
            ? `🚨 Heavy Rain Imminent at ${loc.name}`
            : `🌧️ Rain Alert (${maxRainProb}%) at ${loc.name}`;
          const message = `High precipitation probability (${maxRainProb}%) detected in next 90 minutes. Preventive drain and terrace door checks required.`;

          const { data: newAlert, error: alertErr } = await supabase
            .from('weather_alerts')
            .insert({
              site_id: (loc as any).siteId || null,
              city_name: loc.name,
              latitude: loc.lat,
              longitude: loc.lon,
              alert_type: alertType,
              severity,
              title,
              message,
              timing: 'Within 90 mins',
            })
            .select('id')
            .single();

          if (alertErr || !newAlert) {
            results.push({ location: loc.name, status: 'ERROR', error: alertErr });
            continue;
          }

          // 5. Auto-Generate Checklist Tasks
          const tasksToInsert = [
            {
              alert_id: newAlert.id,
              site_id: (loc as any).siteId || null,
              task_name: 'Check Storm Drain Valves & Desilt Pits',
              category: 'FACILITIES',
              urgency: isCritical ? 'CRITICAL' : 'HIGH',
              description: 'Clear trash and leaves from stormwater grates; verify discharge pits are flowing freely.',
              suggested_role: 'MEP / Technical Team',
              action_code: 'CHECK_DRAINS',
              status: 'PENDING',
            },
            {
              alert_id: newAlert.id,
              site_id: (loc as any).siteId || null,
              task_name: 'Lock Terrace Doors & Fire Shaft Louvers',
              category: 'SECURITY',
              urgency: isCritical ? 'CRITICAL' : 'HIGH',
              description: 'Prevent rainwater ingress into lift shafts and top-floor common corridors.',
              suggested_role: 'Security / Patrol Staff',
              action_code: 'LOCK_TERRACE',
              status: 'PENDING',
            },
            {
              alert_id: newAlert.id,
              site_id: (loc as any).siteId || null,
              task_name: 'Verify Basement Sump Pumps on AUTO',
              category: 'ELECTRICAL',
              urgency: isCritical ? 'CRITICAL' : 'HIGH',
              description: 'Check control panel float switches to ensure automatic de-watering activates.',
              suggested_role: 'MEP / Electrician',
              action_code: 'VERIFY_PUMPS',
              status: 'PENDING',
            },
          ];

          await supabase.from('weather_tasks').insert(tasksToInsert);

          // 6. Push into notifications table for app team broadcast
          await supabase.from('notifications').insert({
            title,
            message,
            link: '/weather',
            type: 'WEATHER_ALERT',
            severity: isCritical ? 'High' : 'Medium',
          });

          results.push({
            location: loc.name,
            status: 'ALERT_DISPATCHED',
            severity,
            maxRainProb,
            tasksCreated: tasksToInsert.length,
          });
        } else {
          results.push({
            location: loc.name,
            status: 'NORMAL',
            maxRainProb,
            maxWind,
          });
        }
      } catch (locErr: any) {
        results.push({ location: loc.name, status: 'FAILED', error: locErr?.message });
      }
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      evaluatedLocations: monitoredLocations.length,
      results,
    });
  } catch (error: any) {
    console.error('[weather-cron] Execution failed:', error);
    return res.status(500).json({ error: error?.message || 'Weather cron failed' });
  }
}

