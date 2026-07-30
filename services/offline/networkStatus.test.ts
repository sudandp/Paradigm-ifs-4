/**
 * networkStatus.test.ts
 *
 * Regression tests for the offline network-status module.
 *
 * CRITICAL — Risk #1 regression guard:
 *   "Two concurrent subscribers, one reconnect event → drain fires exactly once"
 *
 * Run: npx vitest run services/offline/networkStatus.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock @capacitor/network ─────────────────────────────────────────────────
const _capacitorListeners: Array<(s: { connected: boolean }) => void> = [];

vi.mock("@capacitor/network", () => ({
  Network: {
    getStatus: vi.fn().mockResolvedValue({ connected: true }),
    addListener: vi.fn(
      (_event: string, cb: (s: { connected: boolean }) => void) => {
        _capacitorListeners.push(cb);
        return Promise.resolve({ remove: () => {} });
      }
    ),
  },
}));

function simulateReconnect(connected: boolean) {
  _capacitorListeners.forEach((cb) => cb({ connected }));
}

describe("networkStatus", () => {
  beforeEach(() => {
    _capacitorListeners.length = 0;
    vi.resetModules();
  });

  afterEach(() => vi.clearAllMocks());

  // ── Test 1 ──────────────────────────────────────────────────────────────
  it("single subscriber receives exactly one callback per network event", async () => {
    const { initNetworkStatus, onStatusChange } = await import("./networkStatus");
    await initNetworkStatus();

    const cb = vi.fn();
    onStatusChange(cb);
    simulateReconnect(true);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(true);
  });

  // ── Test 2: RISK #1 REGRESSION GUARD — do not remove ────────────────────
  //
  // Before the fix, onStatusChange() called Network.addListener() per subscriber.
  // Two subscribers = two Capacitor listeners → two drain() calls per reconnect
  // → duplicate Supabase upserts + double photo uploads (functional failure).
  //
  // After the fix: initNetworkStatus() owns the single Capacitor listener.
  // onStatusChange() only manages the _listeners Set.
  it("[RISK-1] two concurrent subscribers each get exactly ONE callback per reconnect", async () => {
    const { initNetworkStatus, onStatusChange } = await import("./networkStatus");
    await initNetworkStatus();

    const sub1 = vi.fn();
    const sub2 = vi.fn();
    onStatusChange(sub1);
    onStatusChange(sub2);

    simulateReconnect(true); // ONE reconnect event

    expect(sub1).toHaveBeenCalledTimes(1);
    expect(sub2).toHaveBeenCalledTimes(1);

    // Capacitor addListener called exactly ONCE total (in initNetworkStatus)
    const { Network } = await import("@capacitor/network");
    expect(Network.addListener).toHaveBeenCalledTimes(1);
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────
  it("cleanup unsubscribes — callback is NOT called after cleanup()", async () => {
    const { initNetworkStatus, onStatusChange } = await import("./networkStatus");
    await initNetworkStatus();

    const cb = vi.fn();
    const cleanup = onStatusChange(cb);
    cleanup();
    simulateReconnect(true);

    expect(cb).not.toHaveBeenCalled();
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────
  it("subscribers receive false on disconnect event", async () => {
    const { initNetworkStatus, onStatusChange } = await import("./networkStatus");
    await initNetworkStatus();

    const cb = vi.fn();
    onStatusChange(cb);
    simulateReconnect(false);

    expect(cb).toHaveBeenCalledWith(false);
  });

  // ── Test 5 ──────────────────────────────────────────────────────────────
  it("isOnline() snapshot reflects the most recent event", async () => {
    const { initNetworkStatus, isOnline } = await import("./networkStatus");
    await initNetworkStatus();

    expect(isOnline()).toBe(true); // initial — mocked getStatus returns connected:true

    simulateReconnect(false);
    expect(isOnline()).toBe(false);

    simulateReconnect(true);
    expect(isOnline()).toBe(true);
  });
});
