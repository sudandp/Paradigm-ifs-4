import { describe, it, expect } from 'vitest';
import { generateOfflineId, isUuid, generateOperationId } from '../services/offline/idGenerator';

describe('Offline ID & Operation Generator', () => {
  it('generates valid RFC 4122 v4 UUIDs', () => {
    const id = generateOfflineId();
    expect(typeof id).toBe('string');
    expect(isUuid(id)).toBe(true);
  });

  it('generates unique UUIDs across successive calls', () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = generateOfflineId();
      expect(set.has(id)).toBe(false);
      set.add(id);
    }
    expect(set.size).toBe(100);
  });

  it('validates UUID format correctly', () => {
    expect(isUuid('3fa85f64-5717-4562-b3fc-2c963f66afa6')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(12345)).toBe(false);
    expect(isUuid('')).toBe(false);
  });

  it('generates structured operation IDs with prefix and timestamp', () => {
    const opId = generateOperationId('snag_audit');
    expect(opId.startsWith('snag_audit_')).toBe(true);
    const parts = opId.split('_');
    expect(parts.length).toBeGreaterThanOrEqual(3);
    const uuidPart = parts[parts.length - 1];
    expect(isUuid(uuidPart)).toBe(true);
  });
});
