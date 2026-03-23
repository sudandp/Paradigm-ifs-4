import { openDB, IDBPDatabase } from 'idb';
import { SQLiteConnection, SQLiteDBConnection, CapacitorSQLite } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const DB_NAME = 'paradigm_offline_db';
const DB_VERSION = 6;

export interface OutboxItem {
  id?: number;
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPDATE_ASSETS' | 'UPDATE_TOOLS' | 'SAVE_SETTINGS';
  payload: any;
  timestamp: string;
  status: 'pending' | 'syncing' | 'failed';
}

class OfflineDatabase {
  private idb: IDBPDatabase | null = null;
  private sqlite: SQLiteDBConnection | null = null;
  private isMobile: boolean;

  constructor() {
    this.isMobile = Capacitor.getPlatform() !== 'web';
  }

  async init() {
    if (this.isMobile) {
      await this.initSQLite();
    } else {
      await this.initIDB();
    }
  }

  private async initIDB() {
    this.idb = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Create outbox store
        let outboxStore;
        if (!db.objectStoreNames.contains('outbox')) {
          outboxStore = db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
        } else {
          outboxStore = transaction.objectStore('outbox');
        }

        if (!outboxStore.indexNames.contains('status')) {
          outboxStore.createIndex('status', 'status');
        }

        // Create cache store
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      },
    });
  }

  private async initSQLite() {
    const connection = new SQLiteConnection(CapacitorSQLite);
    const isConn = (await connection.isConnection(DB_NAME, false)).result;

    if (isConn) {
      this.sqlite = await connection.retrieveConnection(DB_NAME, false);
    } else {
      this.sqlite = await connection.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);
    }

    await this.sqlite.open();

    const createOutboxTable = `
      CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        status TEXT NOT NULL
      );
    `;
    const createCacheTable = `
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
    `;

    await this.sqlite.execute(createOutboxTable);
    await this.sqlite.execute(createCacheTable);
  }

  async addToOutbox(item: Omit<OutboxItem, 'id' | 'status' | 'timestamp'>) {
    const fullItem: OutboxItem = {
      ...item,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    if (this.isMobile && this.sqlite) {
      const query = `INSERT INTO outbox (table_name, action, payload, timestamp, status) VALUES (?, ?, ?, ?, ?)`;
      await this.sqlite.run(query, [fullItem.table_name, fullItem.action, JSON.stringify(fullItem.payload), fullItem.timestamp, fullItem.status]);
    } else if (this.idb) {
      await this.idb.add('outbox', fullItem);
    }
  }

  async getPendingOutbox(): Promise<OutboxItem[]> {
    if (this.isMobile && this.sqlite) {
      const res = await this.sqlite.query(`SELECT * FROM outbox WHERE status = 'pending'`);
      return (res.values || []).map(v => ({
        ...v,
        payload: JSON.parse(v.payload)
      }));
    } else if (this.idb) {
      return await this.idb.getAllFromIndex('outbox', 'status', 'pending');
    }
    return [];
  }

  async updateOutboxStatus(id: number, status: OutboxItem['status']) {
    if (this.isMobile && this.sqlite) {
      await this.sqlite.run(`UPDATE outbox SET status = ? WHERE id = ?`, [status, id]);
    } else if (this.idb) {
      const item = await this.idb.get('outbox', id);
      if (item) {
        item.status = status;
        await this.idb.put('outbox', item);
      }
    }
  }

  async deleteFromOutbox(id: number) {
    if (this.isMobile && this.sqlite) {
      await this.sqlite.run(`DELETE FROM outbox WHERE id = ?`, [id]);
    } else if (this.idb) {
      await this.idb.delete('outbox', id);
    }
  }

  async setCache(key: string, value: any) {
    const timestamp = new Date().toISOString();
    if (this.isMobile && this.sqlite) {
      await this.sqlite.run(`INSERT OR REPLACE INTO cache (key, value, timestamp) VALUES (?, ?, ?)`, [key, JSON.stringify(value), timestamp]);
    } else if (this.idb) {
      await this.idb.put('cache', { key, value, timestamp });
    }
  }

  async getCache(key: string): Promise<any | null> {
    if (this.isMobile && this.sqlite) {
      const res = await this.sqlite.query(`SELECT value FROM cache WHERE key = ?`, [key]);
      return res.values?.[0] ? JSON.parse(res.values[0].value) : null;
    } else if (this.idb) {
      const res = await this.idb.get('cache', key);
      return res ? res.value : null;
    }
    return null;
  }

  async getCacheWithTimestamp(key: string): Promise<{ value: any; timestamp: string } | null> {
    if (this.isMobile && this.sqlite) {
      const res = await this.sqlite.query(`SELECT value, timestamp FROM cache WHERE key = ?`, [key]);
      return res.values?.[0] ? { value: JSON.parse(res.values[0].value), timestamp: res.values[0].timestamp } : null;
    } else if (this.idb) {
      const res = await this.idb.get('cache', key);
      return res ? { value: res.value, timestamp: res.timestamp } : null;
    }
    return null;
  }

  async setSyncTime(timestamp: string) {
    await this.setCache('last_sync_time', timestamp);
  }

  async getSyncTime(): Promise<string | null> {
    return await this.getCache('last_sync_time');
  }
}

export const offlineDb = new OfflineDatabase();
