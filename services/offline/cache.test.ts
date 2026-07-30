/**
 * cache.test.ts
 *
 * Runtime unit tests for services/offline/cache.ts:
 *   - ht_master_options cache (write, read by category, invalidation)
 *   - snag_audits cache (write single, bulk write, read sorted, delete)
 *   - ht_yard_audits cache (write, read, delete)
 *   - Pre-migration IDB data compatibility (legacy raw objects read cleanly)
 *
 * Run: npx vitest run services/offline/cache.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HTMasterOption, OfflineHTYardAuditRecord } from "../../types/htYard";
import type { SnagEntry } from "../../types/operations";

// ─── In-memory IDB store mock for cache ─────────────────────────────────────

const _masterOptions: Record<string, HTMasterOption> = {};
const _snags: Record<string, SnagEntry & { pending?: boolean }> = {};
const _htAudits: Record<string, OfflineHTYardAuditRecord> = {};

vi.mock("./featureFlag", () => ({
  isOfflineEnabled: () => true,
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();

  const mockTxStore = {
    put: vi.fn((item: any) => {
      if (item.category && item.fieldKey !== undefined) _masterOptions[item.id] = item;
      else if (item.snagNumber !== undefined || item.criticality !== undefined || item.snagPoint !== undefined) _snags[item.id] = item;
      else _htAudits[item.id] = item;
      return Promise.resolve();
    }),
    delete: vi.fn((id: string) => {
      delete _masterOptions[id];
      delete _snags[id];
      delete _htAudits[id];
      return Promise.resolve();
    }),
  };

  const mockDb = {
    put: vi.fn((storeName: string, item: any) => {
      if (storeName === "ht_master_options") _masterOptions[item.id] = item;
      if (storeName === "snag_audits") _snags[item.id] = item;
      if (storeName === "ht_yard_audits") _htAudits[item.id] = item;
      return Promise.resolve();
    }),
    get: vi.fn((storeName: string, id: string) => {
      if (storeName === "ht_master_options") return Promise.resolve(_masterOptions[id]);
      if (storeName === "snag_audits") return Promise.resolve(_snags[id]);
      if (storeName === "ht_yard_audits") return Promise.resolve(_htAudits[id]);
      return Promise.resolve(undefined);
    }),
    getAll: vi.fn((storeName: string) => {
      if (storeName === "ht_master_options") return Promise.resolve(Object.values(_masterOptions));
      if (storeName === "snag_audits") return Promise.resolve(Object.values(_snags));
      if (storeName === "ht_yard_audits") return Promise.resolve(Object.values(_htAudits));
      return Promise.resolve([]);
    }),
    getAllFromIndex: vi.fn((storeName: string, indexName: string, value: string) => {
      if (storeName === "ht_master_options" && indexName === "by-category") {
        return Promise.resolve(Object.values(_masterOptions).filter((o) => o.category === value));
      }
      return Promise.resolve([]);
    }),
    delete: vi.fn((storeName: string, id: string) => {
      if (storeName === "ht_master_options") delete _masterOptions[id];
      if (storeName === "snag_audits") delete _snags[id];
      if (storeName === "ht_yard_audits") delete _htAudits[id];
      return Promise.resolve();
    }),
    clear: vi.fn((storeName: string) => {
      if (storeName === "ht_master_options") Object.keys(_masterOptions).forEach((k) => delete _masterOptions[k]);
      if (storeName === "snag_audits") Object.keys(_snags).forEach((k) => delete _snags[k]);
      if (storeName === "ht_yard_audits") Object.keys(_htAudits).forEach((k) => delete _htAudits[k]);
      return Promise.resolve();
    }),
    transaction: vi.fn(() => ({
      store: mockTxStore,
      done: Promise.resolve(),
    })),
  };

  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(mockDb),
  };
});

function clearAllStores() {
  Object.keys(_masterOptions).forEach((k) => delete _masterOptions[k]);
  Object.keys(_snags).forEach((k) => delete _snags[k]);
  Object.keys(_htAudits).forEach((k) => delete _htAudits[k]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("cache.ts — HT Master Options Cache", () => {
  beforeEach(() => clearAllStores());

  it("cacheMasterOptions writes typed rows and getCachedMasterOptions filters by category", async () => {
    const { cacheMasterOptions, getCachedMasterOptions } = await import("./cache");

    const options: HTMasterOption[] = [
      { id: "opt-1", category: "RMUMD", fieldKey: "mfr", optionValue: "ABB", isActive: true },
      { id: "opt-2", category: "RMUMD", fieldKey: "mfr", optionValue: "Schneider", isActive: true },
      { id: "opt-3", category: "TRMaster Data", fieldKey: "type", optionValue: "Oil", isActive: true },
    ];

    await cacheMasterOptions(options);

    const rmuOpts = await getCachedMasterOptions("RMUMD");
    expect(rmuOpts).toHaveLength(2);
    expect(rmuOpts.map((o) => o.optionValue)).toEqual(["ABB", "Schneider"]);

    const trOpts = await getCachedMasterOptions("TRMaster Data");
    expect(trOpts).toHaveLength(1);
    expect(trOpts[0].optionValue).toBe("Oil");
  });

  it("invalidateMasterOptions clears specified category or entire store", async () => {
    const { cacheMasterOptions, getCachedMasterOptions, invalidateMasterOptions } = await import("./cache");

    await cacheMasterOptions([
      { id: "opt-1", category: "RMUMD", fieldKey: "mfr", optionValue: "ABB", isActive: true },
      { id: "opt-2", category: "TRMaster Data", fieldKey: "type", optionValue: "Oil", isActive: true },
    ]);

    await invalidateMasterOptions("RMUMD");
    expect(await getCachedMasterOptions("RMUMD")).toHaveLength(0);
    expect(await getCachedMasterOptions("TRMaster Data")).toHaveLength(1);

    await invalidateMasterOptions(); // clear all
    expect(await getCachedMasterOptions("TRMaster Data")).toHaveLength(0);
  });
});

describe("cache.ts — Snag Audits Cache", () => {
  beforeEach(() => clearAllStores());

  it("cacheSnagEntry and cacheSnagEntries write typed entries; getCachedSnagEntries returns timestamp-sorted list", async () => {
    const { cacheSnagEntry, cacheSnagEntries, getCachedSnagEntries } = await import("./cache");

    const snag1: SnagEntry = {
      id: "snag-1",
      emailAddress: "tech@example.com",
      nameOfSite: "Site A",
      purposeOfVisit: ["Monthly Audit"],
      department: ["MEP"],
      snagDescription: "Oil leak",
      actionToBeTaken: "Fix seal",
      criticality: "High",
      status: "Open",
      timestamp: "2026-07-30T10:00:00Z",
    };

    const snag2: SnagEntry = {
      id: "snag-2",
      emailAddress: "tech@example.com",
      nameOfSite: "Site B",
      purposeOfVisit: ["Monthly Audit"],
      department: ["MEP"],
      snagDescription: "Rust on panel",
      actionToBeTaken: "Paint",
      criticality: "Medium",
      status: "Open",
      timestamp: "2026-07-30T12:00:00Z", // later timestamp
    };

    await cacheSnagEntry(snag1);
    await cacheSnagEntries([snag2]);

    const cached = await getCachedSnagEntries();
    expect(cached).toHaveLength(2);
    // Should be descending by timestamp (snag2 first)
    expect(cached[0].id).toBe("snag-2");
    expect(cached[1].id).toBe("snag-1");
  });

  it("deleteSnagEntryFromCache removes specific item from IDB", async () => {
    const { cacheSnagEntry, deleteSnagEntryFromCache, getCachedSnagEntries } = await import("./cache");

    const snag: SnagEntry = {
      id: "snag-del-1",
      emailAddress: "tech@example.com",
      nameOfSite: "Site A",
      purposeOfVisit: ["Monthly Audit"],
      department: ["MEP"],
      snagDescription: "Test",
      actionToBeTaken: "Test",
      criticality: "Low",
      status: "Open",
      timestamp: "2026-07-30T10:00:00Z",
    };
    await cacheSnagEntry(snag);
    expect(await getCachedSnagEntries()).toHaveLength(1);

    await deleteSnagEntryFromCache("snag-del-1");
    expect(await getCachedSnagEntries()).toHaveLength(0);
  });
});

describe("cache.ts — HT Yard Audits Cache", () => {
  beforeEach(() => clearAllStores());

  it("cacheHtYardAudit and getCachedHtYardAudits handle full payload with equipment instances and responses", async () => {
    const { cacheHtYardAudit, getCachedHtYardAudits, deleteHtYardAuditFromCache } = await import("./cache");

    const record: OfflineHTYardAuditRecord = {
      id: "ht-audit-1",
      site_name: "Substation A",
      reference_number: "REF-101",
      audit_date: "2026-07-30",
      client_division: "North Division",
      status: "Submitted",
      equipment_instances: [{ id: "eq-1", moduleType: "RMU", instanceName: "RMU 1" }],
      responses: { rmu_1: { ok: true } },
      snag_items: [{ id: "snag-ht-1", snagPoint: "Hot spot" }],
    };

    await cacheHtYardAudit(record);
    const cached = await getCachedHtYardAudits();

    expect(cached).toHaveLength(1);
    expect(cached[0].id).toBe("ht-audit-1");
    expect(cached[0].site_name).toBe("Substation A");
    expect(cached[0].equipment_instances).toHaveLength(1);
    expect(cached[0].equipment_instances?.[0].instanceName).toBe("RMU 1");

    await deleteHtYardAuditFromCache("ht-audit-1");
    expect(await getCachedHtYardAudits()).toHaveLength(0);
  });
});

describe("cache.ts — Pre-migration Untyped Raw IDB Data Compatibility", () => {
  beforeEach(() => clearAllStores());

  it("legacy raw snake_case rows stored before typed migration are read without runtime error or lost fields", async () => {
    const { getCachedHtYardAudits, getCachedSnagEntries } = await import("./cache");

    // Manually populate _htAudits with a legacy raw object as stored before the type migration
    _htAudits["legacy-ht-1"] = {
      id: "legacy-ht-1",
      site_name: "Legacy Site",
      reference_number: "LEG-001",
      audit_date: "2026-07-29",
      status: "Draft",
      equipment_instances: [{ id: "legacy-eq" }],
      responses: {},
      snag_items: [],
      pending: true,
    } as any;

    _snags["legacy-snag-1"] = {
      id: "legacy-snag-1",
      emailAddress: "legacy@example.com",
      nameOfSite: "Legacy Site",
      purposeOfVisit: ["Monthly Audit"],
      department: ["MEP"],
      snagDescription: "Pre-existing snag point",
      actionToBeTaken: "Legacy action",
      criticality: "High",
      status: "Open",
      timestamp: "2026-07-28T08:00:00Z",
      pending: false,
    } as any;

    const cachedHt = await getCachedHtYardAudits();
    expect(cachedHt).toHaveLength(1);
    expect(cachedHt[0].site_name).toBe("Legacy Site");
    expect(cachedHt[0].pending).toBe(true);

    const cachedSnag = await getCachedSnagEntries();
    expect(cachedSnag).toHaveLength(1);
    expect(cachedSnag[0].snagDescription).toBe("Pre-existing snag point");
  });
});
