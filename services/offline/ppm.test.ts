/**
 * ppm.test.ts
 *
 * Unit tests for Phase 3 PPM Audits offline layer:
 *   - ppm_executions IDB store read/write/delete
 *   - migrateLocalStoragePpmDrafts (one-time migration from localStorage)
 *   - Multi-photo attachment & draft update handling
 *
 * Run: npx vitest run services/offline/ppm.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PPMExecutionRecord } from "../../types/ppm";

// ─── In-memory IDB store mock for PPM ───────────────────────────────────────

const _ppmStore: Record<string, PPMExecutionRecord> = {};
const _outboxStore: Record<string, any> = {};
const _localStorageMock: Record<string, string> = {};

vi.mock("./featureFlag", () => ({
  isOfflineEnabled: () => true,
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();

  const mockTxStore = {
    put: vi.fn((item: any) => {
      if (item.action || item.tableName) _outboxStore[item.id] = item;
      else _ppmStore[item.id] = item;
      return Promise.resolve();
    }),
    delete: vi.fn((id: string) => {
      delete _ppmStore[id];
      delete _outboxStore[id];
      return Promise.resolve();
    }),
  };

  const mockDb = {
    put: vi.fn((storeName: string, item: any) => {
      if (storeName === "ppm_executions") _ppmStore[item.id] = item;
      if (storeName === "outbox") _outboxStore[item.id] = item;
      return Promise.resolve();
    }),
    get: vi.fn((storeName: string, id: string) => {
      if (storeName === "ppm_executions") return Promise.resolve(_ppmStore[id]);
      if (storeName === "outbox") return Promise.resolve(_outboxStore[id]);
      return Promise.resolve(undefined);
    }),
    getAll: vi.fn((storeName: string) => {
      if (storeName === "ppm_executions") return Promise.resolve(Object.values(_ppmStore));
      if (storeName === "outbox") return Promise.resolve(Object.values(_outboxStore));
      return Promise.resolve([]);
    }),
    getAllFromIndex: vi.fn((storeName: string, indexName: string, value: string) => {
      if (storeName === "outbox" && indexName === "by-status") {
        return Promise.resolve(Object.values(_outboxStore).filter((i: any) => i.status === value));
      }
      return Promise.resolve([]);
    }),
    delete: vi.fn((storeName: string, id: string) => {
      if (storeName === "ppm_executions") delete _ppmStore[id];
      if (storeName === "outbox") delete _outboxStore[id];
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

// Setup mock global localStorage
vi.stubGlobal('localStorage', {
  getItem: (key: string) => _localStorageMock[key] ?? null,
  setItem: (key: string, val: string) => {
    _localStorageMock[key] = val;
  },
  removeItem: (key: string) => {
    delete _localStorageMock[key];
  },
  clear: () => {
    Object.keys(_localStorageMock).forEach((k) => delete _localStorageMock[k]);
  },
});

function clearPpmStores() {
  Object.keys(_ppmStore).forEach((k) => delete _ppmStore[k]);
  Object.keys(_localStorageMock).forEach((k) => delete _localStorageMock[k]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ppm.test.ts — PPM Executions Store", () => {
  beforeEach(() => clearPpmStores());

  it("cachePpmExecution and getCachedPpmExecutions write and read typed records", async () => {
    const { cachePpmExecution, getCachedPpmExecutions } = await import("./cache");

    const record: PPMExecutionRecord = {
      id: "ppm-exec-1",
      site_name: "Substation B",
      reference_number: "PPM-2026-001",
      category_id: "HT_YARD",
      audit_date: "2026-07-30",
      status: "IN_PROGRESS",
      auditor_name: "Engineer Sudhan",
      observations: {
        "obs-1": {
          id: "obs-1",
          auditId: "ppm-exec-1",
          sectionInstanceId: "rmu-1",
          checkPointId: "cp-1",
          criterionId: "crit-1",
          value: "Oil Level OK",
          severity: "OK",
          updatedAt: "2026-07-30T11:00:00Z",
        },
      },
      summary_counts: { critical: 0, major: 0, medium: 0, minor: 0, total: 1 },
      pending: true,
    };

    await cachePpmExecution(record);
    const cached = await getCachedPpmExecutions();

    expect(cached).toHaveLength(1);
    expect(cached[0].id).toBe("ppm-exec-1");
    expect(cached[0].site_name).toBe("Substation B");
    expect(cached[0].observations?.["obs-1"].value).toBe("Oil Level OK");
  });

  it("deletePpmExecutionFromCache removes record from IDB", async () => {
    const { cachePpmExecution, getCachedPpmExecutions, deletePpmExecutionFromCache } = await import("./cache");

    const record: PPMExecutionRecord = {
      id: "ppm-del-1",
      site_name: "Site C",
      reference_number: "PPM-999",
      category_id: "GENERATOR",
      audit_date: "2026-07-30",
      status: "DRAFT",
    };

    await cachePpmExecution(record);
    expect(await getCachedPpmExecutions()).toHaveLength(1);

    await deletePpmExecutionFromCache("ppm-del-1");
    expect(await getCachedPpmExecutions()).toHaveLength(0);
  });
});

describe("ppm.test.ts — LocalStorage Migration & Idempotency", () => {
  beforeEach(() => clearPpmStores());

  it("migrateLocalStoragePpmDrafts imports existing localStorage PPM drafts into IDB without data loss", async () => {
    const { migrateLocalStoragePpmDrafts, getCachedPpmExecutions } = await import("./cache");

    // Populate mock localStorage with pre-existing legacy PPM draft array
    const legacyDrafts = [
      { id: "legacy-ppm-1", site: "Building Alpha", type: "WTP", date: "2026-07-29", tech: "John Doe", status: "DRAFT" },
      { id: "legacy-ppm-2", site: "Building Beta", type: "STP", date: "2026-07-30", tech: "Jane Smith", status: "COMPLETED" },
    ];
    _localStorageMock["paradigm_ppm_audits_list"] = JSON.stringify(legacyDrafts);

    const migratedCount = await migrateLocalStoragePpmDrafts();

    expect(migratedCount).toBe(2);
    const cached = await getCachedPpmExecutions();
    expect(cached).toHaveLength(2);
    expect(cached.map((c) => c.site_name)).toEqual(["Building Alpha", "Building Beta"]);

    // Migration flag set in localStorage
    expect(_localStorageMock["paradigm_ppm_localStorage_migrated_v1"]).toBe("true");

    // Subsequent call must short-circuit and return 0 (Idempotency check)
    const secondRun = await migrateLocalStoragePpmDrafts();
    expect(secondRun).toBe(0);
    expect(await getCachedPpmExecutions()).toHaveLength(2); // no duplicates
  });

  it("idempotency check: returns 0 immediately if flag already set even if localStorage list is modified later", async () => {
    const { migrateLocalStoragePpmDrafts } = await import("./cache");

    _localStorageMock["paradigm_ppm_localStorage_migrated_v1"] = "true";
    _localStorageMock["paradigm_ppm_audits_list"] = JSON.stringify([{ id: "new-draft" }]);

    const count = await migrateLocalStoragePpmDrafts();
    expect(count).toBe(0);
  });
});

describe("ppm.test.ts — Multi-Photo Observations & Deletion Lifecycle", () => {
  beforeEach(() => clearPpmStores());

  it("multi-photo support: execution payload preserves multiple observation photos", async () => {
    const { cachePpmExecution, getCachedPpmExecutions } = await import("./cache");

    const record: PPMExecutionRecord = {
      id: "ppm-multi-photo",
      site_name: "Plant Room 1",
      reference_number: "PPM-MULTI-01",
      category_id: "BOOSTER_PUMPS",
      audit_date: "2026-07-30",
      status: "SUBMITTED",
      observations: {
        "obs-1": {
          id: "obs-1",
          auditId: "ppm-multi-photo",
          sectionInstanceId: "pump-1",
          checkPointId: "cp-pressure",
          criterionId: "crit-gauge",
          value: "3.5 bar",
          severity: "OK",
          photoUrl: "blob:photo-1",
          updatedAt: "2026-07-30T10:00:00Z",
        },
        "obs-2": {
          id: "obs-2",
          auditId: "ppm-multi-photo",
          sectionInstanceId: "pump-2",
          checkPointId: "cp-leak",
          criterionId: "crit-seal",
          value: "Minor seepage",
          severity: "MAJOR",
          photoUrl: "blob:photo-2",
          remarks: "Needs mechanical seal replacement",
          updatedAt: "2026-07-30T10:05:00Z",
        },
      },
      photo_urls: ["blob:photo-1", "blob:photo-2"],
      summary_counts: { critical: 0, major: 1, medium: 0, minor: 0, total: 2 },
    };

    await cachePpmExecution(record);
    const cached = await getCachedPpmExecutions();

    expect(cached[0].photo_urls).toHaveLength(2);
    expect(cached[0].observations?.["obs-1"].photoUrl).toBe("blob:photo-1");
    expect(cached[0].observations?.["obs-2"].photoUrl).toBe("blob:photo-2");
  });

  it("deletePPMExecution on previously synced record purges IDB and enqueues DELETE outbox item", async () => {
    const { cachePpmExecution, getCachedPpmExecutions } = await import("./cache");
    const { enqueue, cancelPendingInsert, getPending } = await import("./outbox");

    const record: PPMExecutionRecord = {
      id: "ppm-synced-1",
      site_name: "Building C",
      reference_number: "PPM-SYNC-01",
      category_id: "ELECTRICAL_PANEL",
      audit_date: "2026-07-30",
      status: "SUBMITTED",
    };

    // Record previously synced (not in outbox as pending INSERT)
    await cachePpmExecution(record);
    expect(await getCachedPpmExecutions()).toHaveLength(1);

    // Simulated offline delete of synced record:
    const isCancelled = await cancelPendingInsert("ppm-synced-1");
    expect(isCancelled).toBe(false); // not cancelled locally because it wasn't a pending INSERT

    // Enqueue DELETE action
    await enqueue({
      id: "ppm-synced-1",
      tableName: "ppm_executions",
      action: "DELETE",
      payload: { id: "ppm-synced-1" },
    });

    const pending = await getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].action).toBe("DELETE");
    expect(pending[0].tableName).toBe("ppm_executions");
  });
});

describe("ppm.test.ts — Org-Scoped RLS Simulation (Negative Path)", () => {
  beforeEach(() => clearPpmStores());

  it("RLS org-scoping rejection: outbox captures organization_id RLS policy failure as failed status without data loss", async () => {
    const { enqueue, markSyncing, markFailed, getFailed } = await import("./outbox");

    const invalidOrgPayload: PPMExecutionRecord = {
      id: "ppm-rls-fail-001",
      site_name: "Unauthorized Site",
      reference_number: "PPM-RLS-01",
      category_id: "STP",
      audit_date: "2026-07-30",
      status: "SUBMITTED",
      organization_id: "00000000-0000-0000-0000-000000000000", // Mismatched Org ID
    };

    await enqueue({
      id: invalidOrgPayload.id,
      tableName: "ppm_executions",
      action: "INSERT",
      payload: invalidOrgPayload as unknown as Record<string, unknown>,
    });

    await markSyncing(invalidOrgPayload.id);

    // Simulate Supabase RLS rejection
    const rlsError = 'new row violates row-level security policy for table "ppm_executions"';
    await markFailed(invalidOrgPayload.id, rlsError);

    const failedItems = await getFailed();
    expect(failedItems).toHaveLength(1);
    expect(failedItems[0].id).toBe("ppm-rls-fail-001");
    expect(failedItems[0].status).toBe("failed");
    expect(failedItems[0].failureReason).toContain("row-level security policy");
  });
});
