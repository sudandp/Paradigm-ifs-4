import { describe, it, expect, beforeEach } from 'vitest';

const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
});

import {
  computePayloadHash,
  isShadowWriteEnabled,
  setShadowWriteEnabled,
  startMigrationJournalEntry,
  completeMigrationJournalEntry,
  getMigrationJournal,
  verifyMigratedRecords,
} from '../services/offline/migrationJournal';

describe('Phase 2A: Migration Journal & Safety Net', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('computes deterministic SHA-256 hashes for records', async () => {
    const payloadA = { id: 'rec-1', name: 'Site A', criticality: 'HIGH' };
    const payloadB = { criticality: 'HIGH', name: 'Site A', id: 'rec-1' }; // Different key order
    const hashA = await computePayloadHash(payloadA);
    const hashB = await computePayloadHash(payloadB);

    expect(typeof hashA).toBe('string');
    expect(hashA.length).toBeGreaterThanOrEqual(8);
    // Hash should be deterministic regardless of object key order
    expect(hashA).toBe(hashB);
  });

  it('toggles and persists shadow write mode', () => {
    expect(isShadowWriteEnabled()).toBe(false);
    setShadowWriteEnabled(true);
    expect(isShadowWriteEnabled()).toBe(true);
    setShadowWriteEnabled(false);
    expect(isShadowWriteEnabled()).toBe(false);
  });

  it('records migration lifecycle in journal', () => {
    const entry = startMigrationJournalEntry('user-admin');
    expect(entry.status).toBe('in_progress');
    expect(entry.userId).toBe('user-admin');

    const updated = completeMigrationJournalEntry(entry.id, {
      status: 'completed',
      rowsMigrated: 42,
      hashesVerified: true,
      storesProcessed: ['snag_audits', 'outbox'],
    });

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe('completed');
    expect(updated?.rowsMigrated).toBe(42);
    expect(updated?.completedAt).toBeDefined();

    const journal = getMigrationJournal();
    expect(journal.length).toBe(1);
    expect(journal[0].id).toBe(entry.id);
  });

  it('verifies record parity between source and target datasets', async () => {
    const sourceRecords = [
      { id: '1', name: 'Item 1', val: 100 },
      { id: '2', name: 'Item 2', val: 200 },
    ];
    const targetRecordsIdentical = [
      { id: '1', name: 'Item 1', val: 100 },
      { id: '2', name: 'Item 2', val: 200 },
    ];

    const result = await verifyMigratedRecords(sourceRecords, targetRecordsIdentical, 'test_table');
    expect(result.passed).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it('catches hash mismatches and missing records during migration verification', async () => {
    const sourceRecords = [
      { id: '1', name: 'Item 1', val: 100 },
      { id: '2', name: 'Item 2', val: 200 },
    ];
    const targetRecordsCorrupted = [
      { id: '1', name: 'Item 1 (tampered)', val: 999 }, // Mismatch
      // '2' is completely missing
    ];

    const result = await verifyMigratedRecords(sourceRecords, targetRecordsCorrupted, 'test_table');
    expect(result.passed).toBe(false);
    expect(result.mismatches.length).toBe(2);
    expect(result.mismatches[0].id).toBe('1');
    expect(result.mismatches[0].reason).toContain('Hash mismatch');
    expect(result.mismatches[1].id).toBe('2');
    expect(result.mismatches[1].reason).toContain('Missing record');
  });
});
