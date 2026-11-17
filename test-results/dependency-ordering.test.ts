import { describe, it, expect } from 'vitest';
import { sortItemsByDependencies } from '../services/offline/syncEngine';
import type { OutboxItem } from '../services/offline/db';

describe('Phase 2: Topological Dependency Ordering', () => {
  function makeItem(id: string, createdAt: number, dependsOn?: string): OutboxItem {
    return {
      id,
      tableName: 'test_table',
      action: 'UPSERT',
      status: 'pending',
      payload: { id },
      createdAt,
      attempts: 0,
      dependsOn,
    };
  }

  it('orders parent before child regardless of insertion or timestamp order', () => {
    // Child created at 100, but depends on parent created at 200
    const child = makeItem('child-doc', 100, 'parent-onboarding');
    const parent = makeItem('parent-onboarding', 200);

    const sorted = sortItemsByDependencies([child, parent]);

    expect(sorted.map((i) => i.id)).toEqual(['parent-onboarding', 'child-doc']);
  });

  it('orders deep dependency chain correctly (A -> B -> C)', () => {
    const itemC = makeItem('item-c', 300, 'item-b');
    const itemB = makeItem('item-b', 200, 'item-a');
    const itemA = makeItem('item-a', 100);

    // Shuffle input: [C, A, B]
    const sorted = sortItemsByDependencies([itemC, itemA, itemB]);

    expect(sorted.map((i) => i.id)).toEqual(['item-a', 'item-b', 'item-c']);
  });

  it('preserves chronological FIFO order for independent items', () => {
    const item1 = makeItem('item-1', 100);
    const item2 = makeItem('item-2', 200);
    const item3 = makeItem('item-3', 300);

    const sorted = sortItemsByDependencies([item2, item1, item3]);

    expect(sorted.map((i) => i.id)).toEqual(['item-1', 'item-2', 'item-3']);
  });

  it('handles circular dependencies gracefully without infinite loop', () => {
    const item1 = makeItem('item-1', 100, 'item-2');
    const item2 = makeItem('item-2', 200, 'item-1');

    const sorted = sortItemsByDependencies([item1, item2]);

    expect(sorted).toHaveLength(2);
    expect(sorted.map((i) => i.id)).toContain('item-1');
    expect(sorted.map((i) => i.id)).toContain('item-2');
  });
});
