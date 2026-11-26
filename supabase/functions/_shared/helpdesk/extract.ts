// @ts-nocheck: Supabase Edge Function (Deno) module.
// Turns a free-text complaint into structured ticket fields.
// Groq LLM (JSON mode) first; deterministic keyword/regex fallback when the key is missing or the call fails.

export const CATEGORIES = ['Electrical', 'Plumbing', 'Housekeeping', 'Security', 'Civil', 'HVAC', 'General'] as const;

/** Canonical issue types. Duplicate detection compares these, so keep slugs stable. */
export const ISSUE_TYPES: Record<string, string> = {
  water_leakage: 'Plumbing', drain_blockage: 'Plumbing', no_water_supply: 'Plumbing',
  low_water_pressure: 'Plumbing', tap_or_fixture_broken: 'Plumbing', toilet_flush_issue: 'Plumbing',
  tank_overflow: 'Plumbing', sewage_overflow: 'Plumbing',
  power_outage: 'Electrical', light_not_working: 'Electrical', switch_or_socket_fault: 'Electrical',
  sparking_or_burning_smell: 'Electrical', generator_issue: 'Electrical', lift_not_working: 'Electrical',
  street_light_not_working: 'Electrical',
  ac_not_cooling: 'HVAC', ac_water_leak: 'HVAC', ventilation_issue: 'HVAC',
  garbage_not_collected: 'Housekeeping', area_not_cleaned: 'Housekeeping', washroom_unclean: 'Housekeeping',
  pest_control: 'Housekeeping', bad_smell: 'Housekeeping',
  guard_absent: 'Security', unauthorized_entry: 'Security', gate_or_access_issue: 'Security',
  cctv_not_working: 'Security', theft_or_suspicious_activity: 'Security',
  wall_crack_or_seepage: 'Civil', ceiling_leak: 'Civil', door_or_window_broken: 'Civil',
  tile_or_floor_damage: 'Civil', painting_required: 'Civil',
  other: 'General',
};

export type Intent = 'issue' | 'greeting' | 'thanks' | 'status_query' | 'other';

export interface Extraction {
  intent: Intent;
  is_issue: boolean;
  title: string;
  category: string;
  issue_type: string;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  tower: string | null;
  floor: string | null;
  area: string | null;
  unit: string | null;
  confidence: number;
  language: string | null;
  source: 'llm' | 'rules';
}

export interface SiteLocationRow { kind: 'tower' | 'floor' | 'area'; value: string; aliases: string[] }

// ---------------------------------------------------------------------------
// Location parsing / normalisation
// ---------------------------------------------------------------------------
const ORDINALS: Record<string, string> = {
  ground: 'G', first: '1', second: '2', third: '3', fourth: '4', fifth: '5', sixth: '6',
  seventh: '7', eighth: '8', ninth: '9', tenth: '10', eleventh: '11', twelfth: '12',
};

const squash = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function parseLocation(text: string): { tower: string | null; floor: string | null; unit: string | null } {
  const t = ` ${text} `;
  let tower: string | null = null;
  let floor: string | null = null;
  let unit: string | null = null;

  const tw = t.match(/\b(?:tower|twr|block|blk|wing|building|bldg)\s*[-#:.]?\s*(?:no\.?\s*)?([a-z]?\d{1,3}[a-z]?|[a-z])\b/i)
    ?? t.match(/\bT\s*-?\s*(\d{1,2})\b/i);
  if (tw) tower = tw[1];

  const fl = t.match(/\b(\d{1,2})\s*(?:st|nd|rd|th)?\s*(?:floor|flr)\b/i)
    ?? t.match(/\b(?:floor|flr|fl)\s*[-#:.]?\s*(\d{1,2}|g|ground)\b/i)
    ?? t.match(/\b(ground|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s*(?:floor|flr)\b/i)
    ?? t.match(/\bF\s*-?\s*(\d{1,2})\b/i);
  if (fl) floor = fl[1];
  else if (/\b(?:basement|cellar)\b/i.test(t)) {
    const b = t.match(/\b(?:basement|cellar)\s*-?\s*(\d)?/i);
    floor = `B${b?.[1] ?? '1'}`;
  } else if (/\b(?:terrace|roof\s*top|rooftop)\b/i.test(t)) floor = 'TERRACE';

  const un = t.match(/\b(?:flat|unit|apt|apartment|villa|shop|office|room)\s*(?:no\.?)?\s*[-#:.]?\s*([a-z]?\d{2,5}[a-z]?)\b/i);
  if (un) unit = un[1].toUpperCase();

  return { tower, floor, unit };
}

export function normalizeFloor(raw: string | null): string | null {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase()
    .replace(/\s*floor$/, '').replace(/^floor\s*/, '')
    .replace(/^(\d+)\s*(st|nd|rd|th)$/, '$1');
  if (ORDINALS[v]) return ORDINALS[v];
  if (v === 'g' || v === 'gf' || v === '0') return 'G';
  if (/^b\d?$/.test(v) || v.startsWith('basement')) return `B${v.match(/\d/)?.[0] ?? '1'}`;
  if (v === 'terrace' || v === 'roof') return 'TERRACE';
  const n = v.match(/^\d{1,3}$/);
  return n ? String(Number(n[0])) : squash(v) || null;
}

/** Map a raw tower/area token onto the site's master list (value or alias). Falls back to a tidy token. */
export function normalizeAgainstMaster(raw: string | null, kind: 'tower' | 'area', master: SiteLocationRow[]): string | null {
  if (!raw) return null;
  const key = squash(String(raw).replace(/^(tower|twr|block|blk|wing|building|bldg)\s*/i, ''));
  const full = squash(String(raw));
  for (const row of master.filter((r) => r.kind === kind)) {
    const candidates = [row.value, ...(row.aliases ?? [])].map(squash);
    if (candidates.includes(key) || candidates.includes(full) || candidates.includes(`T${key}`)) return row.value;
  }
  if (!key) return null;
  if (kind === 'tower' && /^\d+$/.test(key)) return `T${Number(key)}`;
  return key;
}

// ---------------------------------------------------------------------------
// Rule-based fallback
// ---------------------------------------------------------------------------
const RULES: [RegExp, string][] = [
  [/\b(spark(s|ing)?|short\s*circuit|burning|smoke|fire)\b/i, 'sparking_or_burning_smell'],
  [/\b(sewage|sewer|manhole)\b/i, 'sewage_overflow'],
  [/\b(power\s*(cut|off|outage|failure)|no\s*(power|current|electricity)|current\s*(cut|gone)|(bijli|light)\s*(nahi|nhi|nahin|band|gayi|gai|chali))\b/i, 'power_outage'],
  [/\b(clog(ged|s)?|blocked|blockage|choke[sd]?|drains?|(drain|pipe|sink|toilet|basin)\s*block)\b/i, 'drain_blockage'],
  [/\b(leak|leakage|leaking|dripping|seepage)\b.*\b(ac|a\/c|air\s*con)\b|\b(ac|a\/c)\b.*\bleak/i, 'ac_water_leak'],
  [/\b(ceiling)\b.*\b(leak|drip|seep)/i, 'ceiling_leak'],
  [/\b(leak|leakage|leaking|dripping|water\s*logg?ing|flood)/i, 'water_leakage'],
  [/\b(no|not)\s*(getting\s*)?water\b|\bwater\s*(not\s*(coming|available)|supply|cut)\b|\b(paani|pani)\s*(nahi|nhi|nahin|band|nai)\b/i, 'no_water_supply'],
  [/\b(low|less)\s*(water\s*)?pressure\b/i, 'low_water_pressure'],
  [/\b(tap|faucet|shower|geyser|pipe)\b/i, 'tap_or_fixture_broken'],
  [/\b(flush|toilet|commode|wc)\b/i, 'toilet_flush_issue'],
  [/\b(tank)\b.*\b(overflow)/i, 'tank_overflow'],
  [/\b(lifts?|elevators?)\b/i, 'lift_not_working'],
  [/\b(street\s*lights?|pole\s*lights?|common\s*area\s*lights?)\b/i, 'street_light_not_working'],
  [/\b(lights?|bulbs?|tube\s*lights?|lamps?)\b/i, 'light_not_working'],
  [/\b(switch|socket|plug|mcb|trip)\b/i, 'switch_or_socket_fault'],
  [/\b(dg|generator|genset)\b/i, 'generator_issue'],
  [/\b(ac|a\/c|air\s*con\w*)\b/i, 'ac_not_cooling'],
  [/\b(exhaust|ventilat)/i, 'ventilation_issue'],
  [/\b(garbage|trash|waste|dustbin)\b/i, 'garbage_not_collected'],
  [/\b(washroom|restroom|toilet)\b.*\b(dirty|unclean|smell)/i, 'washroom_unclean'],
  [/\b(cockroach(es)?|rats?|mosquito(es|s)?|pests?|termites?|bees?)\b/i, 'pest_control'],
  [/\b(smell|stink|odou?r)\b/i, 'bad_smell'],
  [/\b(dirty|not\s*clean(ed)?|sweep|mop|dust)\b/i, 'area_not_cleaned'],
  [/\b(guard|security)\b.*\b(absent|sleep|missing|not\s*(there|present))/i, 'guard_absent'],
  [/\b(cctv|camera)\b/i, 'cctv_not_working'],
  [/\b(theft|stolen|suspicious|intruder)\b/i, 'theft_or_suspicious_activity'],
  [/\b(gate|boom\s*barrier|access\s*card)\b/i, 'gate_or_access_issue'],
  [/\b(crack|seepage|damp)\b/i, 'wall_crack_or_seepage'],
  [/\b(door|window|glass|lock|hinge)\b/i, 'door_or_window_broken'],
  [/\b(tile|floor(ing)?\s*(broken|damage))\b/i, 'tile_or_floor_damage'],
  [/\b(paint|painting)\b/i, 'painting_required'],
];

const P1_HINT = /\b(fire|spark(s|ing)?|smoke|short\s*circuit|flood(ed|ing)?|sewage|stuck\s*in\s*(the\s*)?lift|trapped|theft|intruder|emergency|urgent|danger)\b/i;
const P2_HINT = /\b(no\s*water|(paani|pani)\s*(nahi|nhi|nahin|band|nai)|power\s*(cut|off|outage)|no\s*power|(bijli|light)\s*(nahi|nhi|nahin|band|gayi|gai|chali)|lifts?|elevators?|whole\s*(tower|building|floor)|entire\s*(tower|building|block|floor))\b/i;

function titleCase(slug: string) {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ruleExtract(text: string): Extraction {
  const clean = (text ?? '').trim();
  const loc = parseLocation(clean);
  const base = {
    tower: loc.tower, floor: loc.floor, area: null, unit: loc.unit, language: null, source: 'rules' as const,
  };

  if (/^(hi+|hello|hey|hii+|good\s*(morning|afternoon|evening|night)|namaste|namaskar)\W*$/i.test(clean)) {
    return { ...base, intent: 'greeting', is_issue: false, title: '', category: 'General', issue_type: 'other', priority: 'P4', confidence: 0.9 };
  }
  if (/^(thanks?|thank\s*you|thx|ok+|okay|done|noted|fine|great|👍|🙏|✅)[\s!.🙏👍]*$/iu.test(clean)) {
    return { ...base, intent: 'thanks', is_issue: false, title: '', category: 'General', issue_type: 'other', priority: 'P4', confidence: 0.9 };
  }
  const hit = RULES.find(([re]) => re.test(clean));

  // Status query: a ticket number, or a short "status/update/eta" message that doesn't describe a new problem
  if (/\bTKT-\d{4}-\d+\b/i.test(clean)
      || (!hit && /\b(status|update|any\s*update|when\s*will|eta)\b/i.test(clean) && clean.split(/\s+/).length <= 8)) {
    return { ...base, intent: 'status_query', is_issue: false, title: '', category: 'General', issue_type: 'other', priority: 'P4', confidence: 0.7 };
  }

  const issueType = hit?.[1] ?? 'other';
  const words = clean.split(/\s+/).filter(Boolean).length;
  const isIssue = Boolean(hit) || words >= 4;
  const priority = P1_HINT.test(clean) ? 'P1' : P2_HINT.test(clean) ? 'P2' : 'P3';

  return {
    ...base,
    intent: isIssue ? 'issue' : 'other',
    is_issue: isIssue,
    title: hit ? titleCase(issueType) : clean.slice(0, 80), // location is stored/shown separately
    category: ISSUE_TYPES[issueType] ?? 'General',
    issue_type: issueType,
    priority,
    confidence: hit ? 0.6 : isIssue ? 0.45 : 0.3,
  };
}

// ---------------------------------------------------------------------------
// LLM extraction (Groq, OpenAI-compatible)
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You triage facility-management complaints sent on WhatsApp in India (apartments, offices, tech parks).
Messages may be English, Hindi, Kannada, Tamil, Telugu or mixed (Hinglish). Reply ONLY with a JSON object:
{
 "intent": "issue" | "greeting" | "thanks" | "status_query" | "other",
 "is_issue": boolean,                    // true only if the user reports a problem needing action
 "title": string,                        // short English title, max 70 chars, e.g. "Drain clogged near lift lobby"
 "issue_type": one of ${JSON.stringify(Object.keys(ISSUE_TYPES))},
 "priority": "P1" | "P2" | "P3" | "P4",  // P1 safety/fire/sparks/flooding/sewage/person stuck in lift/security breach; P2 outage affecting many (no water, power cut, lift down); P3 normal; P4 cosmetic/request
 "tower": string | null,                 // identifier only, e.g. "1", "A", "T2". Use known_towers spelling when it matches.
 "floor": string | null,                 // "G", "1".."60", "B1", "TERRACE"
 "area": string | null,                  // common area like "LOBBY", "PARKING", "CLUBHOUSE", "GYM" (use known_areas when it matches)
 "unit": string | null,                  // flat / office number if given
 "language": string,                     // ISO code of the message language
 "confidence": number                    // 0..1, how sure you are about is_issue + issue_type
}
Never invent a location that is not in the message. "first floor" = "1", "ground floor" = "G".`;

export async function llmExtract(text: string, ctx: { towers: string[]; areas: string[] }): Promise<Extraction | null> {
  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('HELPDESK_LLM_MODEL') ?? 'openai/gpt-oss-20b',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify({ message: text.slice(0, 2000), known_towers: ctx.towers, known_areas: ctx.areas }) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const out = JSON.parse(json?.choices?.[0]?.message?.content ?? '{}');

    const issueType = ISSUE_TYPES[out.issue_type] ? out.issue_type : 'other';
    const intent: Intent = ['issue', 'greeting', 'thanks', 'status_query', 'other'].includes(out.intent) ? out.intent : 'other';
    const isIssue = Boolean(out.is_issue) && intent === 'issue';
    return {
      intent: isIssue ? 'issue' : intent === 'issue' ? 'other' : intent,
      is_issue: isIssue,
      title: String(out.title ?? '').trim().slice(0, 120) || titleCase(issueType),
      category: ISSUE_TYPES[issueType],
      issue_type: issueType,
      priority: ['P1', 'P2', 'P3', 'P4'].includes(out.priority) ? out.priority : 'P3',
      tower: out.tower ? String(out.tower) : null,
      floor: out.floor ? String(out.floor) : null,
      area: out.area ? String(out.area) : null,
      unit: out.unit ? String(out.unit) : null,
      confidence: Math.max(0, Math.min(1, Number(out.confidence) || 0.5)),
      language: out.language ?? null,
      source: 'llm',
    };
  } catch (e) {
    console.error('[helpdesk/extract] LLM failed, using rules:', e?.message ?? e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** LLM first, rules as fallback; regex fills any location the model missed; everything normalised to the site master. */
export async function extractIssue(text: string, master: SiteLocationRow[]): Promise<Extraction> {
  const towers = master.filter((r) => r.kind === 'tower').map((r) => r.value);
  const areas = master.filter((r) => r.kind === 'area').map((r) => r.value);
  const result = (await llmExtract(text, { towers, areas })) ?? ruleExtract(text);

  const regex = parseLocation(text);
  result.tower = normalizeAgainstMaster(result.tower ?? regex.tower, 'tower', master);
  result.floor = normalizeFloor(result.floor ?? regex.floor);
  result.area = normalizeAgainstMaster(result.area, 'area', master);
  result.unit = result.unit ?? regex.unit;
  return result;
}
