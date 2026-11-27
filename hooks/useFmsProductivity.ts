import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { getFmsSnapshot, FMS_REALTIME_TABLES, type FmsSnapshot } from '../services/fmsProductivityService';

const POLL_MS = 60_000;      // fallback if the realtime socket drops
const DEBOUNCE_MS = 2_000;   // coalesce bursts of row changes into one refetch
const CLOCK_MS = 30_000;     // re-render countdowns ("34 min left") without refetching

/**
 * Live snapshot for the FMS Productivity Command Center.
 * @param entityId  `entities.id` of the selected site, or undefined for all sites
 * @param siteName  entity name (snag audits are keyed by site name text)
 */
export function useFmsProductivity(entityId?: string, siteName?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['fms-productivity-snapshot', entityId ?? 'all'];

  const query = useQuery<FmsSnapshot>({
    queryKey,
    queryFn: () => getFmsSnapshot(entityId, siteName),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    placeholderData: (prev) => prev, // keep showing the last snapshot while a new site loads
  });

  // Realtime: any change on a source table → debounced invalidate
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const invalidate = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['fms-productivity-snapshot'] });
      }, DEBOUNCE_MS);
    };

    let channel = supabase.channel(`fms-productivity-${Math.random().toString(36).slice(2, 8)}`);
    FMS_REALTIME_TABLES.forEach((table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, invalidate);
    });
    channel.subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Clock tick so time-relative values stay current between fetches
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(id);
  }, []);

  return {
    snapshot: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refresh: () => query.refetch(),
    now,
  };
}
