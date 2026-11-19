/**
 * SQLite Storage Adapter Contract & Migration Tests — Paradigm Offline Hardening
 * Verifies that SqliteStorageAdapter:
 * - Executes versioned schema migration (ALTER TABLE for legacy schemas)
 * - Persists and reconstructs all rich outbox fields (recordId, photoId, attachments, lastError, etc.)
 * - Manages ACID transaction lifecycles (BEGIN TRANSACTION, COMMIT, ROLLBACK on failure)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SqliteStorageAdapter } from '../services/offline/storageRepository';

describe('SqliteStorageAdapter Contract & Migration Tests', () => {
  let mockSqliteDb: any;
  let executedSql: string[] = [];
  let tables: Record<string, any[]> = {};

  beforeEach(() => {
    executedSql = [];
    tables = {
      outbox_items: [],
      domain_records: [],
      attachment_meta: [],
    };

    mockSqliteDb = {
      open: vi.fn(async () => {}),
      execute: vi.fn(async (sql: string) => {
        executedSql.push(sql);
      }),
      run: vi.fn(async (sql: string, params: any[] = []) => {
        executedSql.push(sql);
        if (sql.includes('INSERT OR REPLACE INTO outbox_items')) {
          const id = params[0];
          tables.outbox_items = tables.outbox_items.filter((r) => r.id !== id);
          tables.outbox_items.push({
            id: params[0],
            record_id: params[1],
            table_name: params[2],
            action: params[3],
            status: params[4],
            user_id: params[5],
            org_id: params[6],
            photo_id: params[7],
            attachments: params[8],
            base_updated_at: params[9],
            prior_revisions: params[10],
            schema_version: params[11],
            captured_at: params[12],
            depends_on: params[13],
            payload: params[14],
            created_at: params[15],
            attempts: params[16],
            lease_expires_at: params[17],
            next_attempt_at: params[18],
            failure_reason: params[19],
            last_error: params[20],
          });
        } else if (sql.includes('DELETE FROM outbox_items WHERE id = ?')) {
          tables.outbox_items = tables.outbox_items.filter((r) => r.id !== params[0]);
        }
        return { changes: { changes: 1 } };
      }),
      query: vi.fn(async (sql: string, params: any[] = []) => {
        executedSql.push(sql);
        if (sql.includes('PRAGMA table_info(outbox_items)')) {
          // Simulate legacy schema missing newly added columns
          return {
            values: [
              { name: 'id' },
              { name: 'table_name' },
              { name: 'action' },
              { name: 'status' },
              { name: 'user_id' },
              { name: 'payload' },
              { name: 'created_at' },
            ],
          };
        }
        if (sql.includes('SELECT * FROM outbox_items WHERE id = ?')) {
          const match = tables.outbox_items.find((r) => r.id === params[0]);
          return { values: match ? [match] : [] };
        }
        return { values: [] };
      }),
    };
  });

  it('runs schema migration to add missing columns to legacy outbox_items table', async () => {
    const adapter = new SqliteStorageAdapter();
    (adapter as any)._sqliteConnection = {
      checkConnectionsConsistency: async () => ({ result: true }),
      isConnection: async () => ({ result: true }),
      retrieveConnection: async () => mockSqliteDb,
    };

    await adapter.initialize();

    // Verify ALTER TABLE was called for missing columns
    const alterCalls = executedSql.filter((s) => s.includes('ALTER TABLE outbox_items ADD COLUMN'));
    expect(alterCalls.length).toBeGreaterThanOrEqual(7);
    expect(alterCalls.some((s) => s.includes('record_id'))).toBe(true);
    expect(alterCalls.some((s) => s.includes('photo_id'))).toBe(true);
    expect(alterCalls.some((s) => s.includes('attachments'))).toBe(true);
    expect(alterCalls.some((s) => s.includes('last_error'))).toBe(true);
  });

  it('serializes and deserializes rich outbox metadata accurately', async () => {
    const adapter = new SqliteStorageAdapter();
    (adapter as any)._sqliteConnection = {
      checkConnectionsConsistency: async () => ({ result: true }),
      isConnection: async () => ({ result: true }),
      retrieveConnection: async () => mockSqliteDb,
    };

    const item: any = {
      id: 'out-full-1',
      recordId: 'rec-1',
      tableName: 'snag_audits',
      action: 'UPSERT',
      status: 'pending',
      userId: 'user-b',
      photoId: 'photo-1',
      attachments: [{ photoId: 'photo-1', payloadPath: 'photo', storagePath: 'path/1.jpg' }],
      baseUpdatedAt: '2026-11-19T10:00:00Z',
      priorRevisions: ['rev-0'],
      schemaVersion: 2,
      capturedAt: '2026-11-19T11:00:00Z',
      payload: { id: 'rec-1', snag_description: 'Pipe leaking' },
      createdAt: 1000,
      attempts: 1,
      lastError: 'Temporary network failure',
    };

    await adapter.enqueueOutbox(item);
    const fetched = await adapter.getOutboxItem('out-full-1');

    expect(fetched).toBeDefined();
    expect(fetched?.recordId).toBe('rec-1');
    expect(fetched?.photoId).toBe('photo-1');
    expect(fetched?.attachments).toEqual(item.attachments);
    expect(fetched?.baseUpdatedAt).toBe('2026-11-19T10:00:00Z');
    expect(fetched?.priorRevisions).toEqual(['rev-0']);
    expect(fetched?.schemaVersion).toBe(2);
    expect(fetched?.lastError).toBe('Temporary network failure');
  });

  it('manages transaction rollback on failure and commit on success', async () => {
    const adapter = new SqliteStorageAdapter();
    (adapter as any)._sqliteConnection = {
      checkConnectionsConsistency: async () => ({ result: true }),
      isConnection: async () => ({ result: true }),
      retrieveConnection: async () => mockSqliteDb,
    };

    // Successful transaction
    await adapter.runTransaction('readwrite', ['outbox_items'], async () => {
      return 'ok';
    });
    expect(executedSql).toContain('BEGIN TRANSACTION;');
    expect(executedSql).toContain('COMMIT;');

    // Failed transaction
    await expect(
      adapter.runTransaction('readwrite', ['outbox_items'], async () => {
        throw new Error('Database write error');
      })
    ).rejects.toThrow('Database write error');
    expect(executedSql).toContain('ROLLBACK;');
  });
});
