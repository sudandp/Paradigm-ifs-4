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

// ─── India Post Pincode Resolver ──────────────────────────────────────────────

/**
 * Resolves state from a 6-digit Indian PIN code using India Post API.
 * Falls back to null if offline or invalid pincode.
 */
export async function resolveStateFromPincode(pincode: string): Promise<string | null> {
  const clean = pincode.replace(/\D/g, '');
  if (clean.length !== 6) return null;

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${clean}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (
      Array.isArray(data) &&
      data[0]?.Status === 'Success' &&
      Array.isArray(data[0]?.PostOffice) &&
      data[0].PostOffice.length > 0
    ) {
      return data[0].PostOffice[0].State ?? null;
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
    const position = await getPrecisePosition(50, 8000);

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
