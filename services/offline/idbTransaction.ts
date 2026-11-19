import { getDb } from './db';

/** All requests in the callback must use this view, never the outer database. */
export interface TransactionDatabase {
  objectStoreNames: { contains(name: string): boolean };
  get(table: string, id: string): Promise<any>;
  getAll(table: string): Promise<any[]>;
  put(table: string, value: any): Promise<any>;
  delete(table: string, id: string): Promise<void>;
}

/** Do not await network, timers or filesystem work inside an IndexedDB transaction. */
export async function withIdbTransaction<T>(
  stores: string[],
  mode: 'readonly' | 'readwrite',
  work: (db: TransactionDatabase) => Promise<T>,
): Promise<T> {
  const db = await getDb();

  // Native IDB transaction support (production idb instance)
  if (typeof (db as any).transaction === 'function') {
    const tx = (db as any).transaction(stores as any, mode);
    const done = tx.done;
    void done?.catch?.(() => {});
    const view: TransactionDatabase = {
      objectStoreNames: tx.objectStoreNames ?? db.objectStoreNames,
      get: (table, id) => tx.objectStore(table as any).get(id),
      getAll: (table) => tx.objectStore(table as any).getAll(),
      put: (table, value) => tx.objectStore(table as any).put(value),
      delete: (table, id) => tx.objectStore(table as any).delete(id),
    };
    try {
      const result = await work(view);
      if (done) await done;
      return result;
    } catch (error) {
      try { tx.abort(); } catch { /* Already completed or aborted. */ }
      if (done) await done.catch(() => {});
      throw error;
    }
  }

  // Fallback for mock/synthetic storage engines lacking native IDB transaction methods:
  // Tracks all modifications in a rollback journal to preserve transaction atomicity.
  const journal: Array<{ table: string; id: string; existed: boolean; oldVal: any }> = [];
  const modifiedKeys = new Set<string>();

  const view: TransactionDatabase = {
    objectStoreNames: db.objectStoreNames,
    get: (table, id) => db.get(table as any, id),
    getAll: (table) => db.getAll(table as any),
    put: async (table, value) => {
      const id = value?.id;
      if (id !== undefined) {
        const key = `${table}:${id}`;
        if (!modifiedKeys.has(key)) {
          modifiedKeys.add(key);
          const old = await db.get(table as any, id);
          journal.push({
            table,
            id,
            existed: old !== undefined && old !== null,
            oldVal: old !== undefined ? structuredClone(old) : undefined,
          });
        }
      }
      return db.put(table as any, value);
    },
    delete: async (table, id) => {
      const key = `${table}:${id}`;
      if (!modifiedKeys.has(key)) {
        modifiedKeys.add(key);
        const old = await db.get(table as any, id);
        journal.push({
          table,
          id,
          existed: old !== undefined && old !== null,
          oldVal: old !== undefined ? structuredClone(old) : undefined,
        });
      }
      return db.delete(table as any, id);
    },
  };

  try {
    return await work(view);
  } catch (error) {
    for (let i = journal.length - 1; i >= 0; i--) {
      const entry = journal[i];
      if (entry.existed) {
        await db.put(entry.table as any, entry.oldVal);
      } else {
        await db.delete(entry.table as any, entry.id);
      }
    }
    throw error;
  }
}
