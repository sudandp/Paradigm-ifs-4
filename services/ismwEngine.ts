/**
 * ismwEngine.ts
 * Inter-State Migrant Worker (ISMW) Detection Engine.
 *
 * Uses the India Post Pincode API (free, no auth required):
 * GET https://api.postalpincode.in/pincode/{pincode}
 *
 * Logic:
 * 1. Resolve the worker's permanent address pincode → extract state.
 * 2. Compare against GPS-detected current state (from Capacitor Geolocation
 *    + reverse geocode, which is already wired in locationUtils.ts).
 * 3. If states differ → ISMW flag ON.
 * 4. Force capture of Geo-Tagged Local Address (rent receipt + selfie GPS).
 *
 * Compliance:
 * Under ISMW Act 1979 (and Building & Other Construction Workers Act),
 * cross-state migrant workers require:
 * - Local address for physical PCC (police clearance at deployment city)
 * - Bonafide deployment certificate on Paradigm letterhead
 * - ISMW register entry with Labour Commissioner
 */

import { Geolocation } from '@capacitor/geolocation';
import { reverseGeocode } from '../utils/locationUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ISMWFlags {
  isMigrant: boolean;
  permanentState: string | null;
  currentState: string | null;
  requiresLocalAddress: boolean;
  requiresGeoTaggedPhoto: boolean;
  requiresPhysicalPCC: boolean;
  requiresBonafideCertificate: boolean;
  ismwComplianceNote: string;
}

export interface LocalAddressCapture {
  latitude: number;
  longitude: number;
  resolvedAddress: string;
  rentReceiptUrl?: string;   // Uploaded rent receipt / stay proof
  selfieUrl?: string;        // Geo-tagged selfie at local address
  capturedAt: string;        // ISO timestamp
}

interface IndiaPostResponse {
  Status: string;
  PostOffice: Array<{
    Name: string;
    District: string;
    State: string;
    Country: string;
    Pincode: string;
  }> | null;
}

// ─── State Resolver via India Post API ───────────────────────────────────────

/**
 * Resolve the Indian state name from a 6-digit pincode using India Post API.
 * Returns null if pincode is invalid or API is unreachable (offline).
 */
export async function resolveStateFromPincode(pincode: string): Promise<string | null> {
  if (!/^\d{6}$/.test(pincode.trim())) return null;

  try {
    const res = await fetch(
      `https://api.postalpincode.in/pincode/${pincode.trim()}`,
      { signal: AbortSignal.timeout(8000) } // 8-second timeout for offline resilience
    );
    const data: IndiaPostResponse[] = await res.json();
    const record = data?.[0];

    if (record?.Status === 'Success' && record.PostOffice?.length) {
      return record.PostOffice[0].State.trim();
    }
    return null;
  } catch {
    // Offline or API down — return null; caller must handle gracefully
    return null;
  }
}

// ─── GPS State Resolver ───────────────────────────────────────────────────────

/**
 * Gets the current device GPS coordinates and reverse-geocodes to a state name.
 * Reuses the existing reverseGeocode() from locationUtils.ts.
 */
async function resolveCurrentStateFromGPS(): Promise<string | null> {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    const address = await reverseGeocode(
      position.coords.latitude,
      position.coords.longitude,
    );

    // reverseGeocode returns a human-readable string; extract state heuristically
    // Format expected: "Area, City, State, Country"
    if (address) {
      const parts = address.split(',').map((p) => p.trim());
      // State is typically the 3rd from last part in Indian addresses
      if (parts.length >= 3) {
        return parts[parts.length - 2] ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── State Name Normalizer ────────────────────────────────────────────────────

/**
 * Normalizes state name variants for comparison.
 * e.g., "Tamil Nadu", "TAMIL NADU", "tamilnadu" → "tamil nadu"
 */
function normalizeState(state: string | null): string | null {
  return state?.toLowerCase().replace(/\s+/g, ' ').trim() ?? null;
}

// ─── Main ISMW Detection Function ─────────────────────────────────────────────

/**
 * Detect if a worker is an inter-state migrant.
 *
 * @param permanentPincode Worker's permanent address pincode (from onboarding form)
 * @param permanentStateOverride Optionally pass the state name directly if already known
 * @returns ISMWFlags with full compliance context
 */
export async function detectMigrantStatus(
  permanentPincode: string,
  permanentStateOverride?: string,
): Promise<ISMWFlags> {
  const [permanentState, currentState] = await Promise.all([
    permanentStateOverride
      ? Promise.resolve(permanentStateOverride)
      : resolveStateFromPincode(permanentPincode),
    resolveCurrentStateFromGPS(),
  ]);

  const normPermanent = normalizeState(permanentState);
  const normCurrent = normalizeState(currentState);

  // Cannot determine migrant status if either state is unresolved
  if (!normPermanent || !normCurrent) {
    return {
      isMigrant: false,
      permanentState,
      currentState,
      requiresLocalAddress: false,
      requiresGeoTaggedPhoto: false,
      requiresPhysicalPCC: false,
      requiresBonafideCertificate: false,
      ismwComplianceNote: 'State detection incomplete — manual verification required.',
    };
  }

  const isMigrant = normPermanent !== normCurrent;

  return {
    isMigrant,
    permanentState,
    currentState,
    requiresLocalAddress: isMigrant,
    requiresGeoTaggedPhoto: isMigrant,
    requiresPhysicalPCC: isMigrant,
    requiresBonafideCertificate: isMigrant,
    ismwComplianceNote: isMigrant
      ? `Worker's permanent state (${permanentState}) differs from current deployment state (${currentState}). ISMW Act compliance required: local address capture, physical PCC, and Bonafide Certificate mandatory.`
      : `Worker is local to ${currentState}. No ISMW compliance required.`,
  };
}

// ─── State List for Manual Override Dropdown ─────────────────────────────────

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
