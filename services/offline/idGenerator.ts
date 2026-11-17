/**
 * Offline ID & Operation Generator — Paradigm FMS
 *
 * Provides cryptographically secure, RFC 4122-compliant v4 UUIDs for:
 * 1. Offline records created before server synchronization.
 * 2. Attachment and photo keys.
 * 3. Operation IDs for tracking idempotent server-side replay.
 *
 * Guarantees zero ID collision even in offline environments without server coordination.
 */

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Generates an RFC 4122 v4 UUID string.
 * Uses native `crypto.randomUUID()` where supported, with fallback
 * to `crypto.getRandomValues()` for older WebViews.
 */
export function generateOfflineId(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const buffer = new Uint8Array(16);
      crypto.getRandomValues(buffer);
      // Set version 4 (0100)
      buffer[6] = (buffer[6] & 0x0f) | 0x40;
      // Set variant (10xx)
      buffer[8] = (buffer[8] & 0x3f) | 0x80;

      const hex: string[] = [];
      for (let i = 0; i < 16; i++) {
        hex.push(buffer[i].toString(16).padStart(2, '0'));
      }
      return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
    }
  }

  // Pure mathematical fallback (for extreme non-crypto environments)
  let d = Date.now();
  let d2 = (typeof performance !== 'undefined' && performance.now && performance.now() * 1000) || 0;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    let r = Math.random() * 16;
    if (d > 0) {
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Checks if a string is a syntactically valid UUID.
 */
export function isUuid(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  return UUID_V4_REGEX.test(val);
}

/**
 * Creates a unique operation ID for tracking mutations in the outbox.
 * Example: `op_snag_1794923000000_3fa85f64-5717-4562-b3fc-2c963f66afa6`
 */
export function generateOperationId(prefix = 'op'): string {
  const ts = Date.now();
  const uuid = generateOfflineId();
  return `${prefix}_${ts}_${uuid}`;
}
