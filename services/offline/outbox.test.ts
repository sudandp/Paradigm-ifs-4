/**
 * outbox.test.ts
 *
 * Tests for the IDB outbox: lifecycle (pending → syncing → synced/failed),
 * RLS-rejection negative path, and attempt counting.
 *
 * Run: npx vitest run services/offline/outbox.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OutboxItem, StoredPhoto } from "./db";

// ─── In-memory IDB mock ──────────────────────────────────────────────────────
const _store: Record<string, OutboxItem> = {};
const _photos: Record<string, StoredPhoto> = {};

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();

  const mockDb = {
    put: vi.fn((storeName: string, item: OutboxItem | StoredPhoto) => {
      if (storeName === "outbox") _store[(item as OutboxItem).id] = item as OutboxItem;
      if (storeName === "photos") _photos[(item as StoredPhoto).id] = item as StoredPhoto;
      return Promise.resolve();
    }),
    get: vi.fn((storeName: string, id: string) => {
      if (storeName === "outbox") return Promise.resolve(_store[id]);
      if (storeName === "photos") return Promise.resolve(_photos[id]);
      return Promise.resolve(undefined);
    }),
    delete: vi.fn((storeName: string, id: string) => {
      if (storeName === "outbox") delete _store[id];
      if (storeName === "photos") delete _photos[id];
      return Promise.resolve();
    }),
    getAll: vi.fn(() => Promise.resolve(Object.values(_store))),
    getAllFromIndex: vi.fn((_s: string, _i: string, value: string) =>
      Promise.resolve(
        Object.values(_store).filter((i) => i.status === value)
      )
    ),
  };

  return { ...actual, getDb: vi.fn().mockResolvedValue(mockDb) };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function clearStores() {
  Object.keys(_store).forEach((k) => delete _store[k]);
  Object.keys(_photos).forEach((k) => delete _photos[k]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("outbox — lifecycle", () => {
  beforeEach(() => { clearStores(); vi.resetModules(); });

  it("enqueues with status=pending", async () => {
    const { enqueue, getPending } = await import("./outbox");
    await enqueue({ id: "a", tableName: "snag_audits", action: "INSERT", payload: { id: "a" } });
    const pending = await getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe("pending");
    expect(pending[0].attempts).toBe(0);
  });

  it("markSynced removes the item entirely", async () => {
    const { enqueue, markSyncing, markSynced, getPending } = await import("./outbox");
    await enqueue({ id: "b", tableName: "snag_audits", action: "INSERT", payload: { id: "b" } });
    await markSyncing("b");
    await markSynced("b");
    expect(await getPending()).toHaveLength(0);
    expect(_store["b"]).toBeUndefined();
  });

  it("getPending returns items in FIFO order", async () => {
    const { enqueue, getPending } = await import("./outbox");
    // Simulate slightly different createdAt values
    await enqueue({ id: "first", tableName: "snag_audits", action: "INSERT", payload: { id: "first" } });
    await new Promise((r) => setTimeout(r, 5));
    await enqueue({ id: "second", tableName: "snag_audits", action: "INSERT", payload: { id: "second" } });
    const pending = await getPending();
    expect(pending[0].id).toBe("first");
    expect(pending[1].id).toBe("second");
  });
});

describe("outbox — RLS / validation failure → FAILED status (negative path)", () => {
  // This is the critical compliance test:
  // A record rejected by Supabase (wrong org_id, RLS policy) must
  // persist in IDB with status=failed and failureReason populated.
  // It must NEVER be silently dropped.

  beforeEach(() => { clearStores(); vi.resetModules(); });

  it("rejected record stays in IDB as FAILED with reason — never silently dropped", async () => {
    const { enqueue, getPending, markSyncing, markFailed, getFailed } =
      await import("./outbox");

    await enqueue({
      id: "rls-001",
      tableName: "snag_audits",
      action: "INSERT",
      payload: { id: "rls-001", org_id: "WRONG-ORG" },
    });

    // Simulate sync engine attempting upload
    await markSyncing("rls-001");

    // Supabase returns RLS error
    const rlsMsg =
      'new row violates row-level security policy for table "snag_audits"';
    await markFailed("rls-001", rlsMsg);

    // CRITICAL ASSERTIONS:
    const failed = await getFailed();
    expect(failed).toHaveLength(1);
    expect(failed[0].id).toBe("rls-001");
    expect(failed[0].status).toBe("failed");
    expect(failed[0].failureReason).toBe(rlsMsg);
    expect(failed[0].attempts).toBe(1);

    // Must NOT reappear in pending (no auto-retry)
    expect(await getPending()).toHaveLength(0);
  });

  it("attempt count increments on each rejection — supports future backoff", async () => {
    const { enqueue, markSyncing, markFailed, getFailed } = await import("./outbox");

    await enqueue({ id: "rls-002", tableName: "snag_audits", action: "INSERT", payload: { id: "rls-002" } });

    for (let i = 1; i <= 3; i++) {
      await markSyncing("rls-002");
      await markFailed("rls-002", `Attempt ${i} failed`);
    }

    const failed = await getFailed();
    const item = failed.find((f) => f.id === "rls-002");
    expect(item?.attempts).toBe(3);
    expect(item?.failureReason).toBe("Attempt 3 failed");
    // Still in IDB after 3 failures — never evicted
    expect(_store["rls-002"]).toBeDefined();
  });

  it("DELETE action can also fail and is preserved", async () => {
    const { enqueue, markSyncing, markFailed, getFailed } = await import("./outbox");

    await enqueue({ id: "rls-del-001", tableName: "snag_audits", action: "DELETE", payload: { id: "rls-del-001" } });
    await markSyncing("rls-del-001");
    await markFailed("rls-del-001", "Permission denied on delete");

    const failed = await getFailed();
    expect(failed[0].action).toBe("DELETE");
    expect(failed[0].status).toBe("failed");
  });
});

describe("outbox — photo storage", () => {
  beforeEach(() => { clearStores(); vi.resetModules(); });

  it("stores and retrieves a photo blob by ID", async () => {
    const { storePhoto, getPhoto, deletePhoto } = await import("./outbox");
    const blob = new Blob(["fake-image-data"], { type: "image/jpeg" });
    const id = await storePhoto(blob, "snag.jpg", "rls-001");

    const stored = await getPhoto(id);
    expect(stored).toBeDefined();
    expect(stored?.fileName).toBe("snag.jpg");
    expect(stored?.linkedToId).toBe("rls-001");

    await deletePhoto(id);
    expect(await getPhoto(id)).toBeUndefined();
  });
});

describe("outbox — cancelPendingInsert (offline-create then offline-delete edge case)", () => {
  beforeEach(() => { clearStores(); vi.resetModules(); });

  // The critical compliance edge case:
  // Auditor creates a snag offline, then realizes it's a duplicate and
  // deletes it — still offline. The server has never seen this ID.
  // Sending a DELETE to Supabase for a non-existent row is wasteful
  // and may error under strict RLS. cancelPendingInsert handles this.

  it("cancels a pending INSERT locally — no DELETE sent for a record that never synced", async () => {
    const { enqueue, cancelPendingInsert, getPending } = await import("./outbox");

    await enqueue({ id: "local-001", tableName: "snag_audits", action: "INSERT", payload: { id: "local-001" } });
    expect(await getPending()).toHaveLength(1);

    const cancelled = await cancelPendingInsert("local-001");

    expect(cancelled).toBe(true);
    expect(await getPending()).toHaveLength(0);
    expect(_store["local-001"]).toBeUndefined();
  });

  // This is the gap that was identified: a failed INSERT (RLS-rejected)
  // has never created a server row — sending a DELETE for it would target
  // a non-existent ID, producing a spurious sync error.
  it("[FAILED INSERT] also cancelled locally — RLS-rejected INSERT never created a server row", async () => {
    const { enqueue, markSyncing, markFailed, cancelPendingInsert, getFailed } = await import("./outbox");

    await enqueue({ id: "rls-then-del", tableName: "snag_audits", action: "INSERT", payload: { id: "rls-then-del" } });
    await markSyncing("rls-then-del");
    await markFailed("rls-then-del", 'new row violates row-level security policy');

    // Confirm it's in failed state
    const failed = await getFailed();
    expect(failed.find(f => f.id === "rls-then-del")?.status).toBe("failed");

    // Now user deletes the record offline — should cancel locally, not enqueue DELETE
    const cancelled = await cancelPendingInsert("rls-then-del");

    expect(cancelled).toBe(true);
    expect(_store["rls-then-del"]).toBeUndefined(); // gone from IDB entirely
  });

  it("returns false for an ID with no pending INSERT — normal DELETE path should proceed", async () => {
    const { cancelPendingInsert } = await import("./outbox");

    // ID that was never in the outbox (previously synced record)
    const cancelled = await cancelPendingInsert("synced-001");
    expect(cancelled).toBe(false);
  });

  // 'syncing' is explicitly excluded: the request may already be in-flight
  // and could have reached Supabase — we must not skip the DELETE in that case.
  it("does NOT cancel a syncing INSERT — upload may already be in-flight", async () => {
    const { enqueue, markSyncing, cancelPendingInsert } = await import("./outbox");

    await enqueue({ id: "syncing-001", tableName: "snag_audits", action: "INSERT", payload: { id: "syncing-001" } });
    await markSyncing("syncing-001");

    const cancelled = await cancelPendingInsert("syncing-001");

    expect(cancelled).toBe(false);
    expect(_store["syncing-001"]).toBeDefined(); // must still be in IDB
  });

  it("also removes the associated photo blob when cancelling", async () => {
    const { enqueue, storePhoto, cancelPendingInsert, getPhoto } = await import("./outbox");

    const blob = new Blob(["photo"], { type: "image/jpeg" });
    const photoId = await storePhoto(blob, "snag.jpg", "photo-del-001");
    await enqueue({ id: "photo-del-001", tableName: "snag_audits", action: "INSERT", payload: { id: "photo-del-001" }, photoId });

    await cancelPendingInsert("photo-del-001");

    expect(_store["photo-del-001"]).toBeUndefined();
    expect(await getPhoto(photoId)).toBeUndefined();
  });
});

