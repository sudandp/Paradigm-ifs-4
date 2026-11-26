/**
 * Fast-path entity spotting: which employee / which site the question mentions.
 * Matching is against ALL names (no scope here) — the tools apply access control and ask
 * "Which X?" when several match. We only pass the user's own words on (person_name / site_name).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadAll, peopleDirectory } from '../helpers.js';
import { siteKey } from '../scope.js';
import { STOP } from './text.js';

const GENERIC_NAME_WORDS = new Set(['security', 'officer', 'facility', 'manager', 'admin', 'guard', 'supervisor', 'technician', 'senior',
  'junior', 'executive', 'field', 'staff', 'site', 'team', 'paradigm', 'office', 'helper', 'driver', 'test', 'user', 'accounts', 'finance',
  'kumar', 'hr', 'ops', 'technical', 'operations', 'reliever', 'india', 'bangalore', 'bengaluru', 'mr', 'mrs', 'ms', 'dr', 'sri', 'shri']);

let cache: { at: number; personTokens: Map<string, number>; siteNames: string[]; siteWords: Map<string, string[]> } | null = null;

async function load(sb: SupabaseClient) {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache;
  const dir = await peopleDirectory(sb);
  const personTokens = new Map<string, number>();
  for (const p of dir.rows) {
    for (const t of String(p.name ?? '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)) {
      if (t.length >= 3 && !GENERIC_NAME_WORDS.has(t)) personTokens.set(t, (personTokens.get(t) ?? 0) + 1);
    }
  }
  const [matrix, fin, locs] = await Promise.all([
    loadAll<any>(sb, 'site_responsibility_matrix', 'site_name').catch(() => []),
    loadAll<any>(sb, 'site_finance_tracker', 'site_name').catch(() => []),
    loadAll<any>(sb, 'locations', 'name').catch(() => []),
  ]);
  const names = new Set<string>();
  for (const r of [...matrix, ...fin]) if (r.site_name) names.add(String(r.site_name).trim());
  for (const l of locs) if (l.name && (String(l.name).match(/,/g) ?? []).length < 3) names.add(String(l.name).trim()); // skip geocoded addresses
  const siteNames = [...names];
  // distinctive words per site key (drop very common words so "home"/"apartments" alone never match)
  const SITE_COMMON = new Set(['home', 'apartment', 'apartments', 'residency', 'residents', 'welfare', 'association', 'owners', 'phase', 'the', 'and', 'of',
    'tower', 'towers', 'block', 'entry', 'exit', 'gate', 'city', 'pvt', 'ltd', 'llp', 'pifs', 'swllp', 'ppfms', 'office', 'head', 'project', 'site']);
  const siteWords = new Map<string, string[]>();
  for (const n of siteNames) {
    const w = siteKey(n).split(' ').filter(x => x.length >= 3 && !SITE_COMMON.has(x));
    if (w.length) siteWords.set(n, w);
  }
  cache = { at: Date.now(), personTokens, siteNames, siteWords };
  return cache;
}

export interface Entities {
  self: boolean;
  /** user's words for the person, e.g. "kavya m" */
  person?: string;
  /** user's words for the site, e.g. "nikoo homes" */
  site?: string;
}

const SELF_RE = /\b(i|me|my|mine|myself|am i|did i|have i|do i)\b/;

/**
 * Finds a site phrase first (sites are multi-word and distinctive), then a person among the remaining words.
 * `n` must be normalised (see text.normalize) and should have the period text removed.
 */
export async function extractEntities(sb: SupabaseClient, n: string): Promise<Entities> {
  const c = await load(sb);
  const words = n.trim().split(/\s+/).filter(Boolean);
  const wordSet = new Set(words);
  const out: Entities = { self: SELF_RE.test(n) };

  // ---- site: the site whose distinctive words ALL appear, preferring the most words; also accept the first distinctive word alone
  let best: { name: string; hit: string[] } | null = null;
  for (const [name, sw] of c.siteWords) {
    const hit = sw.filter(w => wordSet.has(w) || wordSet.has(w + 's') || (w.endsWith('s') && wordSet.has(w.slice(0, -1))));
    if (!hit.length) continue;
    if (hit[0] !== sw[0]) continue;                       // must include the site's first distinctive word ("nikoo", "prestige")
    if (STOP.has(sw[0]) && hit.length < 2) continue;      // "total", "top", "green"… alone are words, not sites
    if (c.personTokens.has(sw[0]) && hit.length < 2 && sw.length > 1) continue; // "kavya" is a person, not "Kavya Residency"
    if (!best || hit.length > best.hit.length) best = { name, hit };
  }
  const used = new Set<string>();
  if (best) {
    // keep the user's own wording around the match: "nikoo homes", "aratt milano"
    const i = words.findIndex(w => w.startsWith(best!.hit[0]));
    let j = i + 1;
    while (j < words.length && j - i < 4 && !STOP.has(words[j]) && /^[a-z0-9]+$/.test(words[j])) j++;
    if (words[j] === 'home' || words[j] === 'homes') j++;
    out.site = words.slice(i, j).join(' ');
    words.slice(i, j).forEach(w => used.add(w));
  }

  // ---- person: consecutive tokens that are employee-name tokens (+ a trailing initial like "m")
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (used.has(w) || STOP.has(w) || w.length < 3 || !c.personTokens.has(w)) continue;
    const parts = [w];
    let k = i + 1;
    while (k < words.length && !used.has(words[k]) && (c.personTokens.has(words[k]) || /^[a-z]$/.test(words[k])) && !STOP.has(words[k])) { parts.push(words[k]); k++; }
    out.person = parts.join(' ');
    break;
  }
  return out;
}

/** For tests / admin: clear caches. */
export function clearEntityCache() { cache = null; }
