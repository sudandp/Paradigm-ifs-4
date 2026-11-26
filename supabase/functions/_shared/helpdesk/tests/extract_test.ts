// Run: deno test --allow-env supabase/functions/_shared/helpdesk/tests/
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  normalizeAgainstMaster,
  normalizeFloor,
  parseLocation,
  ruleExtract,
  type SiteLocationRow,
} from '../extract.ts';

// ---------------------------------------------------------------------------
// parseLocation + normalisation
// ---------------------------------------------------------------------------
function loc(text: string, master: SiteLocationRow[] = []) {
  const raw = parseLocation(text);
  return {
    tower: normalizeAgainstMaster(raw.tower, 'tower', master),
    floor: normalizeFloor(raw.floor),
    unit: raw.unit,
  };
}

Deno.test('location: "water clogged on tower 1 first floor" -> T1 / 1', () => {
  assertEquals(parseLocation('water clogged on tower 1 first floor'), { tower: '1', floor: 'first', unit: null });
  assertEquals(loc('water clogged on tower 1 first floor'), { tower: 'T1', floor: '1', unit: null });
});

Deno.test('location: "T2 F3 drain block" -> T2 / 3', () => {
  assertEquals(loc('T2 F3 drain block'), { tower: 'T2', floor: '3', unit: null });
});

Deno.test('location: "Block A ground floor" -> A / G', () => {
  assertEquals(loc('Block A ground floor'), { tower: 'A', floor: 'G', unit: null });
});

Deno.test('location: "basement 2 parking" -> floor B2', () => {
  assertEquals(loc('basement 2 parking'), { tower: null, floor: 'B2', unit: null });
});

Deno.test('location: bare "basement" defaults to B1, terrace detected', () => {
  assertEquals(loc('water logging in basement').floor, 'B1');
  assertEquals(loc('pipe burst on the terrace').floor, 'TERRACE');
});

Deno.test('location: "flat 1203 tap leaking" -> unit 1203, no tower/floor', () => {
  assertEquals(loc('flat 1203 tap leaking'), { tower: null, floor: null, unit: '1203' });
});

Deno.test('location: "5th floor" and "Tower B 4th floor"', () => {
  assertEquals(loc('paani nahi aa raha 5th floor'), { tower: null, floor: '5', unit: null });
  assertEquals(loc('Tower B 4th floor lobby'), { tower: 'B', floor: '4', unit: null });
});

Deno.test('normalizeAgainstMaster: alias "block A" maps to master value TA', () => {
  const master: SiteLocationRow[] = [
    { kind: 'tower', value: 'TA', aliases: ['tower a', 'block a'] },
    { kind: 'tower', value: 'TB', aliases: ['tower b', 'block b'] },
    { kind: 'area', value: 'CLUBHOUSE', aliases: ['club house', 'club'] },
  ];
  assertEquals(loc('Leak in block A ground floor', master).tower, 'TA');
  assertEquals(normalizeAgainstMaster('block A', 'tower', master), 'TA');
  assertEquals(normalizeAgainstMaster('Tower B', 'tower', master), 'TB');
  assertEquals(normalizeAgainstMaster('club house', 'area', master), 'CLUBHOUSE');
  // unknown tower falls back to a tidy token
  assertEquals(normalizeAgainstMaster('C', 'tower', master), 'C');
  assertEquals(normalizeAgainstMaster('07', 'tower', master), 'T7');
  assertEquals(normalizeAgainstMaster(null, 'tower', master), null);
});

Deno.test('normalizeFloor: simple values', () => {
  assertEquals(normalizeFloor('first'), '1');
  assertEquals(normalizeFloor('ground'), 'G');
  assertEquals(normalizeFloor('GF'), 'G');
  assertEquals(normalizeFloor('03'), '3');
  assertEquals(normalizeFloor('3rd floor'), '3');
  assertEquals(normalizeFloor('floor 7'), '7');
  assertEquals(normalizeFloor('B2'), 'B2');
  assertEquals(normalizeFloor('basement'), 'B1');
  assertEquals(normalizeFloor('roof'), 'TERRACE');
  assertEquals(normalizeFloor(null), null);
});

// BUG: the "(st|nd|rd|th)?\s*floor$" strip eats the tail of ordinal words ("fir|st floor").
Deno.test({
  name: 'normalizeFloor: ordinal word + "floor" (BUG: "first floor" -> "FIR")',
  
  fn() {
    assertEquals(normalizeFloor('first floor'), '1');
    assertEquals(normalizeFloor('ground floor'), 'G');
    assertEquals(normalizeFloor('second floor'), '2');
  },
});

// BUG: "1st" without the word floor is not stripped.
Deno.test({
  name: 'normalizeFloor: "1st" (BUG: -> "1ST")',
  
  fn() {
    assertEquals(normalizeFloor('1st'), '1');
  },
});

// ---------------------------------------------------------------------------
// ruleExtract: intents
// ---------------------------------------------------------------------------
for (const msg of ['Hi', 'hello!', 'Hiii', 'Good morning', 'namaste']) {
  Deno.test(`intent greeting: "${msg}"`, () => {
    const r = ruleExtract(msg);
    assertEquals(r.intent, 'greeting');
    assertEquals(r.is_issue, false);
  });
}

for (const msg of ['Thanks', 'thank you!', 'ok', 'Okay', '👍', '🙏', 'noted.']) {
  Deno.test(`intent thanks: "${msg}"`, () => {
    const r = ruleExtract(msg);
    assertEquals(r.intent, 'thanks');
    assertEquals(r.is_issue, false);
  });
}

for (const msg of ['status of TKT-2611-00012', 'TKT-2611-00012', 'any update?', 'when will it be fixed', 'what is the ETA']) {
  Deno.test(`intent status_query: "${msg}"`, () => {
    const r = ruleExtract(msg);
    assertEquals(r.intent, 'status_query');
    assertEquals(r.is_issue, false);
  });
}

// ---------------------------------------------------------------------------
// ruleExtract: realistic issue messages
// ---------------------------------------------------------------------------
interface Case { text: string; issue_type: string; category: string; priority: string; gap?: string }

const CASES: Case[] = [
  { text: 'water clogged on tower 1 first floor', issue_type: 'drain_blockage', category: 'Plumbing', priority: 'P3' },
  { text: 'T2 F3 drain block', issue_type: 'drain_blockage', category: 'Plumbing', priority: 'P3' },
  { text: 'Lift stuck in tower 3, people trapped inside', issue_type: 'lift_not_working', category: 'Electrical', priority: 'P1' },
  { text: 'lift kaam nahi kar raha tower 3', issue_type: 'lift_not_working', category: 'Electrical', priority: 'P2' },
  { text: 'No water supply in tower 5 since morning', issue_type: 'no_water_supply', category: 'Plumbing', priority: 'P2' },
  { text: 'AC not cooling in conference room 3rd floor', issue_type: 'ac_not_cooling', category: 'HVAC', priority: 'P3' },
  { text: 'Water leakage from AC in room 1204', issue_type: 'ac_water_leak', category: 'HVAC', priority: 'P3' },
  { text: 'Garbage not collected from tower 2 since 2 days', issue_type: 'garbage_not_collected', category: 'Housekeeping', priority: 'P3' },
  { text: 'Bathroom tap broken in flat 804', issue_type: 'tap_or_fixture_broken', category: 'Plumbing', priority: 'P3' },
  { text: 'flat 1203 tap leaking', issue_type: 'water_leakage', category: 'Plumbing', priority: 'P3' },
  { text: 'Toilet flush not working 2nd floor washroom', issue_type: 'toilet_flush_issue', category: 'Plumbing', priority: 'P3' },
  { text: 'Cockroaches in pantry area, need pest control', issue_type: 'pest_control', category: 'Housekeeping', priority: 'P3' },
  { text: 'Security guard sleeping at main gate', issue_type: 'guard_absent', category: 'Security', priority: 'P3' },
  { text: 'Ceiling leaking in clubhouse after rain', issue_type: 'ceiling_leak', category: 'Civil', priority: 'P3' },
  { text: 'Sewage overflowing near basement 1 parking', issue_type: 'sewage_overflow', category: 'Plumbing', priority: 'P1' },
  { text: 'Street light not working near gate 2', issue_type: 'street_light_not_working', category: 'Electrical', priority: 'P3' },
  { text: 'Crack in wall of flat 302 bedroom', issue_type: 'wall_crack_or_seepage', category: 'Civil', priority: 'P3' },
  { text: 'CCTV camera not working at parking entrance', issue_type: 'cctv_not_working', category: 'Security', priority: 'P3' },
  { text: 'Fire in electrical room ground floor, urgent!', issue_type: 'sparking_or_burning_smell', category: 'Electrical', priority: 'P1' },

  // ---- Known rules gaps (kept as ignored tests) ----
  { text: 'paani nahi aa raha 5th floor', issue_type: 'no_water_supply', category: 'Plumbing', priority: 'P2',
    gap: 'Hinglish "paani nahi" not recognised (-> other/General/P3)' },
  { text: 'bijli nahi hai tower 4', issue_type: 'power_outage', category: 'Electrical', priority: 'P2',
    gap: 'Hinglish "bijli nahi" not recognised' },
  { text: 'There is sparking from the switch board in Tower B 4th floor', issue_type: 'sparking_or_burning_smell', category: 'Electrical', priority: 'P1',
    gap: '"sparking" fails \\bspark\\b (RULES + P1_HINT) -> switch_or_socket_fault/P3' },
  { text: 'Power cut in entire block C', issue_type: 'power_outage', category: 'Electrical', priority: 'P2',
    gap: 'location word "block" hits drain_blockage rule first' },
  { text: 'Lights not working in corridor', issue_type: 'light_not_working', category: 'Electrical', priority: 'P3',
    gap: 'plural "lights" fails \\blight\\b' },
  { text: 'Too many cockroaches in the kitchen', issue_type: 'pest_control', category: 'Housekeeping', priority: 'P3',
    gap: 'plural "cockroaches" fails \\bcockroach\\b' },
];

for (const c of CASES) {
  Deno.test({
    name: `issue: "${c.text}" -> ${c.issue_type}/${c.category}/${c.priority}${c.gap ? ` [RULES GAP: ${c.gap}]` : ''}`,
    ignore: false, // gaps fixed in extract.ts
    fn() {
      const r = ruleExtract(c.text);
      assertEquals(r.intent, 'issue');
      assertEquals(r.is_issue, true);
      assertEquals(r.source, 'rules');
      assertEquals({ issue_type: r.issue_type, category: r.category, priority: r.priority },
        { issue_type: c.issue_type, category: c.category, priority: c.priority });
    },
  });
}

Deno.test('ruleExtract: title is the issue type only (location kept in fields); long unmatched text is still an issue', () => {
  const r = ruleExtract('water clogged on tower 1 first floor');
  assertEquals(r.title, 'Drain Blockage');
  assertEquals([r.tower, r.floor], ['1', 'first']);
  const other = ruleExtract('please send someone to check the main hall');
  assertEquals(other.issue_type, 'other');
  assertEquals(other.category, 'General');
  assertEquals(other.is_issue, true);
  assertEquals(ruleExtract('see this').intent, 'other');
});
