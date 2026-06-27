/**
 * travelEngine.ts - Field Staff Travel Log Computation Engine
 *
 * Responsibilities:
 *   1. Read attendance_events GPS coordinates for a user+day
 *   2. Compute total distance using Haversine (+ optional Google Maps validation)
 *   3. Apply deduction rules from travel_rules_config
 *   4. Calculate reimbursable amount from vehicle type rates
 *   5. Write to travel_logs table
 *
 * Hard Rules:
 *   - All monetary amounts computed in INTEGER PAISE, converted to INR at output boundary only
 *   - No hardcoded rates - all config from TravelRulesConfig
 *   - Every step logged at DEBUG level for audit
 *   - This engine ONLY writes travel_logs - never touches payroll_snapshots
 */

import { supabase } from './supabase';
import type { TravelRulesConfig } from './ruleEngine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VehicleType =
  | 'two_wheeler'
  | 'four_wheeler_petrol'
  | 'four_wheeler_diesel'
  | 'public_transport'
  | 'company_vehicle'
  | null;

export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: string;
  eventType?: string;
}

export interface DailyTravelResult {
  userId: string;
  date: string;
  vehicleType: VehicleType;
  totalRawKm: number;
  totalValidatedKm?: number;
  totalEffectiveKm: number;
  deductionKm: number;
  reimbursableKm: number;
  // Paise (integer) - safe for arithmetic
  perKmRatePaise: number;
  grossAmountPaise: number;
  netAmountPaise: number;
  // INR decimal strings - for DB insert (NUMERIC columns)
  perKmRateInr: string;
  grossAmountInr: string;
  netAmountInr: string;
  decisionLog: string[];
}

export interface RunTravelEngineResult {
  processed: number;
  written: number;
  skipped: number;
  errors: string[];
  results: DailyTravelResult[];
}

// ---------------------------------------------------------------------------
// Distance calculation
// ---------------------------------------------------------------------------

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalPathKm(points: GpsPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = haversineKm(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng);
    if (seg > 0.01) total += seg; // filter stationary pings < 10m
  }
  return total;
}

async function googleMapsDistanceKm(origin: GpsPoint, destination: GpsPoint): Promise<number | null> {
  const apiKey = (import.meta as any)?.env?.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.debug('[travelEngine] Google Maps API key not configured - using Haversine');
    return null;
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&mode=driving&key=${apiKey}`;
    const data = await (await fetch(url)).json();
    const element = data?.rows?.[0]?.elements?.[0];
    if (element?.status === 'OK' && element.distance?.value) {
      return element.distance.value / 1000;
    }
    return null;
  } catch {
    console.debug('[travelEngine] Maps API failed - falling back to Haversine');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rate resolver
// ---------------------------------------------------------------------------

function resolveRatePaise(vehicleType: VehicleType, config: TravelRulesConfig): number {
  const rateInr = (() => {
    switch (vehicleType) {
      case 'two_wheeler': return config.twoWheelerRate;
      case 'four_wheeler_petrol': return config.fourWheelerPetrolRate;
      case 'four_wheeler_diesel': return config.fourWheelerDieselRate;
      case 'public_transport': return config.publicTransportRate;
      case 'company_vehicle': return config.companyVehicleRate;
      default: return config.twoWheelerRate;
    }
  })();
  return Math.round(rateInr * 100); // paise
}

// ---------------------------------------------------------------------------
// Core computation (pure - testable)
// ---------------------------------------------------------------------------

export async function computeDailyTravel(
  userId: string,
  date: string,
  gpsPoints: GpsPoint[],
  vehicleType: VehicleType,
  homeToSiteKm: number,
  config: TravelRulesConfig
): Promise<DailyTravelResult> {
  const log: string[] = [];
  log.push(`DEBUG computeDailyTravel user=${userId} date=${date} points=${gpsPoints.length}`);
  log.push(`DEBUG vehicle=${vehicleType} home_to_site_km=${homeToSiteKm}`);
  log.push(`DEBUG config: dailyDeductionKm=${config.dailyDeductionKm} bufferPct=${config.distanceBufferPct}`);

  // Step 1: Raw Haversine distance
  const rawKm = totalPathKm(gpsPoints);
  log.push(`DEBUG raw_haversine_km=${rawKm.toFixed(3)}`);

  // Step 2: Optional Google Maps validation
  let validatedKm: number | undefined;
  if (config.enableGoogleMapsValidation && gpsPoints.length >= 2) {
    const mapsKm = await googleMapsDistanceKm(gpsPoints[0], gpsPoints[gpsPoints.length - 1]);
    if (mapsKm !== null) {
      validatedKm = mapsKm;
      log.push(`DEBUG maps_validated_km=${validatedKm.toFixed(3)}`);
    } else {
      log.push(`DEBUG maps_unavailable: using haversine`);
    }
  }

  // Step 3: Buffer %
  const baseKm = validatedKm ?? rawKm;
  const effectiveKm = +(baseKm * (1 + config.distanceBufferPct / 100)).toFixed(3);
  log.push(`DEBUG effective_km=${effectiveKm} (base=${baseKm.toFixed(3)} buffer=${config.distanceBufferPct}%)`);

  // Step 4: Deductions
  const homeRoundTrip = homeToSiteKm * 2;
  const flatDaily = config.applyDeductionPer === 'day' ? config.dailyDeductionKm : 0;
  const deductionKm = homeRoundTrip + flatDaily;
  log.push(`DEBUG deduction_km=${deductionKm} (home_round_trip=${homeRoundTrip} + flat=${flatDaily})`);

  // Step 5: Reimbursable km
  const reimbursableKm = Math.max(0, effectiveKm - deductionKm);
  log.push(`DEBUG reimbursable_km=${reimbursableKm.toFixed(3)}`);

  // Step 6: Monetary calculation in PAISE (integer arithmetic)
  const perKmRatePaise = resolveRatePaise(vehicleType, config);
  const grossAmountPaise = Math.round(effectiveKm * perKmRatePaise);
  const netAmountPaise = Math.round(reimbursableKm * perKmRatePaise);
  log.push(`DEBUG paise: rate=${perKmRatePaise} gross=${grossAmountPaise} net=${netAmountPaise}`);

  // Step 7: Convert paise to INR decimal strings (output boundary)
  const perKmRateInr = (perKmRatePaise / 100).toFixed(2);
  const grossAmountInr = (grossAmountPaise / 100).toFixed(2);
  const netAmountInr = (netAmountPaise / 100).toFixed(2);
  log.push(`DEBUG inr: rate=${perKmRateInr} gross=${grossAmountInr} net=${netAmountInr}`);

  // Step 8: Idle time tracking calculation
  let totalIdleMinutes = 0;
  if (config.enableIdleTimeTracking && gpsPoints.length >= 2) {
    const sortedPoints = [...gpsPoints].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (let i = 1; i < sortedPoints.length; i++) {
      const p1 = sortedPoints[i - 1];
      const p2 = sortedPoints[i];
      const dist = haversineKm(p1.lat, p1.lng, p2.lat, p2.lng);
      const timeDiffMins = (new Date(p2.timestamp).getTime() - new Date(p1.timestamp).getTime()) / (1000 * 60);
      
      // Stationary (dist < 0.05 km / 50 meters) for a significant duration (> 5 minutes)
      if (dist < 0.05 && timeDiffMins > 5 && timeDiffMins < 180) {
        totalIdleMinutes += timeDiffMins;
      }
    }
    log.push(`DEBUG total_idle_minutes=${totalIdleMinutes.toFixed(1)} (threshold=${config.maxIdleMinutesPerDay} min)`);
    if (totalIdleMinutes > config.maxIdleMinutesPerDay) {
      log.push(`WARNING idle_time_exceeded: ${totalIdleMinutes.toFixed(1)} minutes exceeded daily maximum of ${config.maxIdleMinutesPerDay} minutes.`);
    }
  }

  return {
    userId, date, vehicleType,
    totalRawKm: +rawKm.toFixed(3),
    totalValidatedKm: validatedKm !== undefined ? +validatedKm.toFixed(3) : undefined,
    totalEffectiveKm: effectiveKm,
    deductionKm: +deductionKm.toFixed(3),
    reimbursableKm: +reimbursableKm.toFixed(3),
    perKmRatePaise, grossAmountPaise, netAmountPaise,
    perKmRateInr, grossAmountInr, netAmountInr,
    decisionLog: log,
  };
}

// ---------------------------------------------------------------------------
// DB writer
// ---------------------------------------------------------------------------

export async function writeTravelLogs(results: DailyTravelResult[]): Promise<{ insertedCount: number; errors: string[] }> {
  const errors: string[] = [];
  let insertedCount = 0;

  for (const r of results) {
    try {
      const { error } = await supabase.from('travel_logs').upsert({
        user_id: r.userId,
        travel_date: r.date,
        vehicle_type: r.vehicleType,
        total_km: r.totalEffectiveKm,
        deduction_km: r.deductionKm,
        reimbursable_km: r.reimbursableKm,
        per_km_rate: r.perKmRateInr,
        gross_amount: r.grossAmountInr,
        net_amount: r.netAmountInr,
        raw_km: r.totalRawKm,
        validated_km: r.totalValidatedKm ?? null,
        computation_log: r.decisionLog,
        status: 'computed',
      }, { onConflict: 'user_id,travel_date' });

      if (error) { errors.push(`${r.userId}/${r.date}: ${error.message}`); }
      else insertedCount++;
      console.debug(`[travelEngine] write travel_log user=${r.userId} date=${r.date} net_inr=${r.netAmountInr}`);
    } catch (err: any) {
      errors.push(`${r.userId}/${r.date}: ${err?.message}`);
    }
  }
  return { insertedCount, errors };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runTravelEngine(opts: {
  userIds: string[];
  startDate: string;
  endDate: string;
  travelConfigMap?: Record<string, TravelRulesConfig>;
  dryRun?: boolean;
}): Promise<RunTravelEngineResult> {
  const result: RunTravelEngineResult = { processed: 0, written: 0, skipped: 0, errors: [], results: [] };
  console.debug(`[travelEngine] run: users=${opts.userIds.length} range=${opts.startDate} to ${opts.endDate} dryRun=${opts.dryRun}`);

  const { data: events, error } = await supabase
    .from('attendance_events')
    .select('user_id, timestamp, type, latitude, longitude')
    .in('user_id', opts.userIds)
    .gte('timestamp', opts.startDate + 'T00:00:00Z')
    .lte('timestamp', opts.endDate + 'T23:59:59Z')
    .not('latitude', 'is', null)
    .order('timestamp', { ascending: true });

  if (error) { result.errors.push(`events fetch: ${error.message}`); return result; }
  if (!events?.length) return result;

  const { data: users } = await supabase.from('users').select('id, vehicle_type').in('id', opts.userIds);
  const vehicleMap: Record<string, VehicleType> = {};
  (users ?? []).forEach((u: any) => { vehicleMap[u.id] = u.vehicle_type ?? 'two_wheeler'; });

  // Group by user+date
  const grouped: Record<string, Record<string, GpsPoint[]>> = {};
  for (const ev of events) {
    const date = ev.timestamp.substring(0, 10);
    if (!grouped[ev.user_id]) grouped[ev.user_id] = {};
    if (!grouped[ev.user_id][date]) grouped[ev.user_id][date] = [];
    if (ev.latitude && ev.longitude) {
      grouped[ev.user_id][date].push({ lat: ev.latitude, lng: ev.longitude, timestamp: ev.timestamp, eventType: ev.type });
    }
  }

  const allResults: DailyTravelResult[] = [];
  for (const [userId, dateBuckets] of Object.entries(grouped)) {
    for (const [date, points] of Object.entries(dateBuckets)) {
      result.processed++;
      const config = opts.travelConfigMap?.[userId];
      if (!config?.enableTravelReimbursement) { result.skipped++; continue; }
      try {
        const r = await computeDailyTravel(userId, date, points, vehicleMap[userId] ?? 'two_wheeler', 0, config);
        allResults.push(r);
      } catch (err: any) { result.errors.push(`${userId}/${date}: ${err?.message}`); }
    }
  }

  result.results = allResults;
  if (!opts.dryRun && allResults.length) {
    const wr = await writeTravelLogs(allResults);
    result.written = wr.insertedCount;
    result.errors.push(...wr.errors);
  }
  return result;
}
