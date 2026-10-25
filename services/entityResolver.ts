/**
 * Paradigm Assist — Named Entity Resolver (Phase 2)
 *
 * Fuzzy-matches partial names, typos, initials, and titles against
 * the live Supabase users table. Caches the full user list for fast
 * in-memory fuzzy resolution without repeated DB calls.
 *
 * Also resolves site names and inherits entities from conversation history.
 */

import { supabase } from './supabase';
import type { ConversationTurn } from './intentClassifier';

// ─── Resolved Types ───────────────────────────────────────────────────────────

export interface ResolvedUser {
  id: string;
  name: string;
  role?: string;
  designation?: string;
  siteId?: string;
}

export interface ResolvedSite {
  id: string;
  name: string;
  city?: string;
}

// ─── Entity Resolver ──────────────────────────────────────────────────────────

class EntityResolver {
  private static instance: EntityResolver;

  private userCache: ResolvedUser[] = [];
  private siteCache: ResolvedSite[] = [];
  private cacheLoadedAt: number | null = null;
  private readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

  private constructor() {}

  public static getInstance(): EntityResolver {
    if (!EntityResolver.instance) {
      EntityResolver.instance = new EntityResolver();
    }
    return EntityResolver.instance;
  }

  /**
   * Warm up the cache at app start — loads all users + sites into memory.
   * Should be called once in assistStore.init().
   */
  async warmupCache(): Promise<void> {
    await Promise.all([this.loadUsers(), this.loadSites()]);
    this.cacheLoadedAt = Date.now();
  }

  private async ensureCacheReady(): Promise<void> {
    const expired = !this.cacheLoadedAt || (Date.now() - this.cacheLoadedAt > this.CACHE_TTL_MS);
    if (expired || this.userCache.length === 0) {
      await this.warmupCache();
    }
  }

  private async loadUsers(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, role_id, designation, site_id')
        .eq('is_active', true)
        .limit(500);

      if (!error && data) {
        this.userCache = data.map(u => ({
          id: u.id,
          name: u.name || '',
          role: u.role_id || undefined,
          designation: u.designation || undefined,
          siteId: u.site_id || undefined,
        }));
      }
    } catch (err) {
      console.warn('[EntityResolver] Failed to load user cache:', err);
    }
  }

  private async loadSites(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, address')
        .order('name');

      if (!error && data) {
        this.siteCache = data.map(d => {
          let city: string | undefined;
          if (d.address) {
            if (/bengaluru|bangalore/i.test(d.address)) city = 'Bengaluru';
            else if (/hyderabad/i.test(d.address)) city = 'Hyderabad';
            else if (/pune/i.test(d.address)) city = 'Pune';
            else if (/mumbai/i.test(d.address)) city = 'Mumbai';
          }
          return { id: d.id, name: d.name, city };
        });
      }
    } catch (err) {
      console.warn('[EntityResolver] Failed to load site cache:', err);
    }
  }

  // ─── Person Resolution ──────────────────────────────────────────────────────

  /**
   * Resolve a name fragment to the best-matching user.
   * Handles: partial names, typos (Levenshtein), initials, common misspellings.
   */
  async resolvePerson(nameFragment: string | undefined): Promise<ResolvedUser | null> {
    if (!nameFragment || nameFragment.trim().length < 2) return null;

    await this.ensureCacheReady();

    const query = nameFragment.trim().toLowerCase();

    // 1. Exact substring match (fastest)
    const exactMatch = this.userCache.find(u =>
      u.name.toLowerCase().includes(query) ||
      query.includes(u.name.toLowerCase().split(' ')[0])
    );
    if (exactMatch) return exactMatch;

    // 2. Token-by-token match (handles "kavya m" → "Kavya Mehta")
    const queryTokens = query.split(/\s+/).filter(t => t.length >= 2);
    const tokenMatch = this.userCache.find(u => {
      const nameTokens = u.name.toLowerCase().split(/\s+/);
      return queryTokens.some(qt =>
        nameTokens.some(nt => nt.startsWith(qt) || qt.startsWith(nt))
      );
    });
    if (tokenMatch) return tokenMatch;

    // 3. Fuzzy Levenshtein match (handles typos like "chenamma" → "Chennamma")
    let bestScore = Infinity;
    let bestUser: ResolvedUser | null = null;

    for (const user of this.userCache) {
      const firstName = user.name.split(' ')[0].toLowerCase();
      const fullName = user.name.toLowerCase();

      const scoreFirst = this.levenshtein(query, firstName);
      const scoreFull = this.levenshtein(query, fullName);
      const score = Math.min(scoreFirst, scoreFull);

      // Accept match if edit distance ≤ 2 chars (handles most typos)
      if (score < bestScore && score <= 2) {
        bestScore = score;
        bestUser = user;
      }
    }

    if (bestUser) return bestUser;

    // 4. Fallback: Supabase ILIKE (catches edge cases not in cache)
    try {
      const { data } = await supabase
        .from('users')
        .select('id, name, role_id, designation')
        .ilike('name', `%${nameFragment.trim()}%`)
        .limit(1);

      if (data && data.length > 0) {
        return {
          id: data[0].id,
          name: data[0].name,
          role: data[0].role_id,
          designation: data[0].designation
        };
      }
    } catch (_) {}

    return null;
  }

  // ─── Site Resolution ────────────────────────────────────────────────────────

  /**
   * Resolve a site name fragment to a known site.
   * Handles abbreviations, short names, and informal references.
   */
  resolveSite(siteFragment: string | undefined): ResolvedSite | null {
    if (!siteFragment) return null;
    const q = siteFragment.trim().toLowerCase();

    // Built-in alias map for common short-forms and informal references
    const aliases: Record<string, string> = {
      'nikoo': 'Nikoo Homes',
      'nh': 'Nikoo Homes',
      'uber': 'Uber Verdant',
      'uber verdant': 'Uber Verdant',
      'uv': 'Uber Verdant',
      'exente': 'iTowers Exente',
      'itowers': 'iTowers Exente',
      'kolte': 'iTowers Exente',
      'sunny': 'Sunny Groves',
      'sunny groves': 'Sunny Groves',
      'mantri': 'Mantri Espana',
      'espana': 'Mantri Espana',
    };

    const aliasMatch = Object.entries(aliases).find(([key]) => q.includes(key));
    if (aliasMatch) {
      const targetName = aliasMatch[1];
      const cached = this.siteCache.find(s => s.name === targetName);
      if (cached) return cached;
      // Return stub if not in cache yet
      return { id: 'unknown', name: targetName };
    }

    // Try cache substring match
    const cacheMatch = this.siteCache.find(s =>
      s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase())
    );
    return cacheMatch || null;
  }

  // ─── Conversation History — Entity Inheritance ──────────────────────────────

  /**
   * Inherit the last mentioned person from conversation history.
   * Used for multi-turn follow-ups like "and yesterday?" (inherits same person).
   */
  async inheritPersonFromHistory(history: ConversationTurn[]): Promise<ResolvedUser | null> {
    const reversed = [...history].reverse();

    for (const turn of reversed) {
      if (turn.role !== 'assistant') continue;

      // Try to extract person name from structured assistant responses
      const nameMatch = turn.content.match(
        /(?:Yes|No),?\s+([A-Za-z\s\.]+?)\s+(?:reported|did\s+not|has\s+not|has\s+reported|checked\s+in|punched)/i
      );
      if (nameMatch?.[1]) {
        const resolved = await this.resolvePerson(nameMatch[1].trim());
        if (resolved) return resolved;
      }

      // Also check for "Staff Attendance Verification" card format
      const headerMatch = turn.content.match(/\*\*([A-Za-z\s\.]+)\*\*\s+(?:reported|has\s+not\s+reported|did\s+not)/i);
      if (headerMatch?.[1]) {
        const resolved = await this.resolvePerson(headerMatch[1].trim());
        if (resolved) return resolved;
      }
    }

    return null;
  }

  /**
   * Get all users (for building absent list, roster, etc.)
   */
  async getAllUsers(): Promise<ResolvedUser[]> {
    await this.ensureCacheReady();
    return [...this.userCache];
  }

  /**
   * Get all sites from cache
   */
  getSites(): ResolvedSite[] {
    return [...this.siteCache];
  }

  // ─── Levenshtein Distance ────────────────────────────────────────────────────

  private levenshtein(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] = b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,  // substitution
              matrix[i][j - 1] + 1,       // insertion
              matrix[i - 1][j] + 1        // deletion
            );
      }
    }
    return matrix[b.length][a.length];
  }
}

export const entityResolver = EntityResolver.getInstance();
