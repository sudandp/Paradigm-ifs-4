/**
 * Rules-first question catalogue. Each rule = a recognisable question pattern → one data tool + args.
 * Evaluated in order; the first rule whose `when` matches wins. No AI involved.
 * `examples` double as the user-facing "questions you can ask" list and as the regression test set.
 *
 * Adding a rule: put specific rules BEFORE generic ones, keep `when` strict (a wrong fast match is worse
 * than falling back to the AI planner), and add 2-4 examples.
 */
import type { Entities } from './entities.js';
import type { PeriodHit } from './text.js';

export interface RuleCtx { n: string; e: Entities; p: PeriodHit }
export interface Rule {
  id: string;
  tool: string;
  group: string;
  when: (c: RuleCtx) => boolean;
  args: (c: RuleCtx) => Record<string, any>;
  examples: string[];
}

const t = (re: RegExp) => (c: RuleCtx) => re.test(c.n);
const who = (c: RuleCtx) => (c.e.person ? { person_name: c.e.person } : { about_self: true });
const hasWho = (c: RuleCtx) => !!c.e.person || c.e.self;
const period = (c: RuleCtx, fallback?: string) => {
  const o: Record<string, any> = {};
  if (c.p.period) o.period = c.p.period; else if (fallback) o.period = fallback;
  if (c.p.start_date) o.start_date = c.p.start_date;
  if (c.p.end_date) o.end_date = c.p.end_date;
  return o;
};
const site = (c: RuleCtx) => (c.e.site ? { site_name: c.e.site } : {});
const monthArgs = (c: RuleCtx) => ({ ...(c.p.month ? { month: c.p.month } : {}), ...(c.p.month && c.p.year ? { year: c.p.year } : {}) });

// keyword groups
const INVOICE = /\b(invoice|bill|billing|billed)\b/;
const LEAVE = /\b(leave|earned leave|sick leave|casual leave|comp off|blue leave|pink leave)\b/;
const NOT_AUDIT_TRAIL = (c: RuleCtx) => !/\b(who (changed|edited|modified|updated|deleted|removed|added)|audit trail|change log|changed by|edited by)\b/.test(c.n);

export const RULES: Rule[] = [
  // ================================================================ AUDIT TRAIL (before anything mentioning attendance/invoice)
  {
    id: 'audit_trail', tool: 'get_audit_trail', group: 'Audit trail (admin)',
    when: c => !NOT_AUDIT_TRAIL(c),
    args: c => ({
      ...(c.e.person ? { person_name: c.e.person } : {}), ...site(c), ...period(c),
      area: /attendance|punch/.test(c.n) ? 'attendance' : INVOICE.test(c.n) ? 'invoice' : /login|password/.test(c.n) ? 'login' : /template/.test(c.n) ? 'templates' : 'all',
    }),
    examples: ["who changed kavya m's attendance yesterday", 'who edited nikoo homes invoice', 'audit trail this week', 'who deleted attendance last month'],
  },

  // ================================================================ BILLING / FINANCE
  {
    id: 'billing_totals', tool: 'get_billing_totals', group: 'Billing & invoices',
    when: c => !c.e.site && (INVOICE.test(c.n) || /\b(revenue|billing total|contract value)\b/.test(c.n)) && /\b(total|sum|overall|by company|company wise|top|highest|lowest|trend|all sites|month wise|by month)\b/.test(c.n),
    args: c => ({
      ...monthArgs(c), ...(c.p.period && !c.p.month ? period(c) : {}),
      group_by: /by company|company wise/.test(c.n) ? 'company' : /\btop|highest|lowest|site wise|by site\b/.test(c.n) ? 'site' : /trend|month wise|by month/.test(c.n) ? 'month' : 'none',
      ...(/\blowest\b/.test(c.n) ? { ascending: true } : {}),
    }),
    examples: ['total billed amount in june', 'total billing in june by company', 'top 10 sites by billing in july', 'billing trend this year'],
  },

  {
    id: 'invoice_status_list', tool: 'list_invoice_status', group: 'Billing & invoices',
    when: c => INVOICE.test(c.n) && /\b(not sent|unsent|pending|sent late|late|overdue|status|which sites|sites|list|delayed|attendance pending)\b/.test(c.n) && !(c.e.site && /\b(value|amount|how much|total)\b/.test(c.n)),
    args: c => ({
      ...monthArgs(c), ...site(c),
      status: /not sent|unsent|pending(?! attendance)/.test(c.n) ? 'not_sent' : /sent late|late|delayed/.test(c.n) ? 'sent_late' : /overdue/.test(c.n) ? 'overdue' : /attendance pending/.test(c.n) ? 'attendance_pending' : 'all',
      ...(/\bswllp\b/.test(c.n) ? { company: 'SWLLP' } : /\bpifs\b/.test(c.n) ? { company: 'PIFS' } : /\bppfms\b/.test(c.n) ? { company: 'PPFMS' } : {}),
    }),
    examples: ['invoices not sent for july', 'which invoices were sent late in july', 'swllp invoice status august', 'pending invoices this month'],
  },
  {
    id: 'site_invoice_value', tool: 'get_site_invoice', group: 'Billing & invoices',
    when: c => INVOICE.test(c.n) && !!c.e.site,
    args: c => ({ site_name: c.e.site, ...monthArgs(c) }),
    examples: ['nikoo home june month invoice value', 'nikoo homes invoice', 'urban greens july bill amount', 'aratt milano invoice last month'],
  },
  // ================================================================ GPS / WHEREABOUTS
  {
    id: 'whereabouts', tool: 'get_employee_whereabouts', group: 'Field tracking',
    when: c => hasWho(c) && /\b(where|location|located|gps|route|travel|travelled|traveled|km|kilometers|visit|visited|places|went|moving|movement)\b/.test(c.n) && !/\bwhere (do|can|should) i\b/.test(c.n),
    args: c => ({ ...who(c), ...period(c, 'today') }),
    examples: ['where is isaac yesterday', 'where is isaac now', 'how many km did isaac travel today', 'which places did isaac visit on 25 nov'],
  },

  // ================================================================ LEAVE
  {
    id: 'leave_pending_approval', tool: 'get_leave_requests', group: 'Leave',
    when: c => LEAVE.test(c.n) && /\b(pending|waiting|to approve|approval|approve)\b/.test(c.n) && /\b(my|me|i)\b/.test(c.n),
    args: c => ({ mode: 'pending_my_approval', ...period(c) }),
    examples: ['leaves pending my approval', 'leave requests waiting for me to approve'],
  },
  {
    id: 'leave_balance', tool: 'get_leave_balance', group: 'Leave',
    when: c => /\b(balance|remaining|left|available)\b/.test(c.n) && (LEAVE.test(c.n) || /\bhow many leave\b/.test(c.n)),
    args: c => ({ ...who(c), leave_type: /sick/.test(c.n) ? 'sick' : /earned/.test(c.n) ? 'earned' : /comp off/.test(c.n) ? 'comp_off' : /blue/.test(c.n) ? 'blue' : /pink/.test(c.n) ? 'pink' : 'all' }),
    examples: ['my leave balance', 'what is isaac leave balance', 'how many earned leave do i have left', 'kavya sick leave balance'],
  },
  {
    id: 'on_leave', tool: 'get_leave_requests', group: 'Leave',
    when: c => /\b(who|whom|which|staff|employees|people|anyone|any one|how many)\b/.test(c.n) && /\bon leave\b/.test(c.n),
    args: c => ({ mode: 'on_leave', ...period(c, 'today'), ...site(c) }),
    examples: ['who is on leave today', 'who is on leave this week', 'how many people on leave tomorrow', 'staff on leave at nikoo homes'],
  },
  {
    id: 'leave_history', tool: 'get_leave_requests', group: 'Leave',
    when: c => hasWho(c) && LEAVE.test(c.n) && /\b(history|taken|applied|took|how many|list|details|days)\b/.test(c.n),
    args: c => ({ mode: 'person_history', ...who(c), ...period(c, 'this_year') }),
    examples: ['how many leaves did kavya take this year', 'my leave history', 'isaac leaves applied last month'],
  },

  // ================================================================ ATTENDANCE (single person)
  {
    id: 'attendance_days', tool: 'get_attendance_summary', group: 'Attendance',
    when: c => hasWho(c) && (/\bhow many (working )?days\b|\bdays (worked|present|attended)\b|\bno of days\b|\bnumber of days\b|\bworking days\b/.test(c.n)
      || /\battendance\b/.test(c.n) && !/\b(rule|policy|grace)\b/.test(c.n)),
    args: c => ({ ...who(c), ...period(c, 'this_month') }),
    examples: ['how many days kavya works', 'how many days did i work this month', 'kavya attendance last month', 'isaac attendance in october'],
  },
  {
    id: 'present_on_day', tool: 'get_attendance_summary', group: 'Attendance',
    when: c => hasWho(c) && /\b(present|absent|came|come|punch|punched|punch in|punch out|in time|login time|logged in|on duty|duty|reached|check in|checked in|check out)\b/.test(c.n),
    args: c => ({ ...who(c), ...period(c, 'today') }),
    examples: ['is kavya present yesterday', 'what time did isaac punch in today', 'did i punch out yesterday', 'was kavya absent on 20 nov'],
  },

  // ================================================================ OVERTIME / SHIFT / HOLIDAY
  {
    id: 'overtime', tool: 'get_overtime', group: 'Overtime',
    when: t(/\b(overtime|extra work|extra hours|ot hours|ot bank)\b/),
    args: c => ({ ...(c.e.person ? { person_name: c.e.person } : c.e.self ? { about_self: true } : { team: true }), ...period(c) }),
    examples: ['overtime hours in october', 'my overtime this month', 'isaac ot last month', 'team overtime this week'],
  },
  {
    id: 'shift_weekly_off', tool: 'get_shift_and_weekly_off', group: 'Shifts & weekly off',
    when: t(/\b(weekly off|week off|weekoff|shifts?|grace time|grace period|duty timing|working hours rule|office timing)\b/),
    args: c => (hasWho(c) ? who(c) : { list_shifts: true }),
    examples: ['what is kavya weekly off', 'my shift timing', 'what is the grace time', 'list all shifts'],
  },
  {
    id: 'holidays', tool: 'get_holidays', group: 'Holidays',
    when: t(/\bholidays?\b/),
    args: c => {
      // holidays look FORWARD: "holidays in december" (said in November) = this December, not last year's
      let p: Record<string, any> = period(c, 'this_month');
      if (c.p.month && !c.p.yearExplicit && c.p.period === 'custom' && c.p.start_date) {
        const y = new Date().getFullYear(), m = c.p.month;
        if (Number(c.p.start_date.slice(0, 4)) < y) p = { period: 'custom', start_date: `${y}-${String(m).padStart(2, '0')}-01`, end_date: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
      }
      return { ...(/\b(next|upcoming|coming)\b/.test(c.n) ? { upcoming: true } : p), ...(c.e.person ? { person_name: c.e.person } : {}) };
    },
    examples: ['holidays this month', 'next holiday', 'upcoming holidays', 'holidays in december'],
  },

  // ================================================================ SITES (before people-profile, since "ops manager of <site>")
  {
    id: 'site_summary', tool: 'get_site_summary', group: 'Sites',
    when: c => !!c.e.site && /\b(summary|overview|dashboard|snapshot|status of|report of|full details)\b/.test(c.n),
    args: c => ({ site_name: c.e.site }),
    examples: ['nikoo homes site summary', 'overview of urban greens', 'status of aratt milano'],
  },
  {
    id: 'site_people', tool: 'get_site_info', group: 'Sites',
    when: c => !!c.e.site && !c.e.person && /\b(manager|incharge|in charge|supervisor|field officer|who (handles|manages|looks after)|responsible|contact|units|takeover|contract|amc|details|info)\b/.test(c.n),
    args: c => ({ site_name: c.e.site }),
    examples: ['who is the ops manager of nikoo homes', 'hr incharge of nikoo homes 1', 'nikoo homes 1 details', 'who handles urban greens'],
  },
  {
    id: 'sites_of_person', tool: 'get_site_info', group: 'Sites',
    when: c => /\b(how many sites|which sites|sites (does|do|handled|under)|my sites|sites of)\b/.test(c.n) && !INVOICE.test(c.n),
    args: c => (c.e.person ? { person_name: c.e.person } : { about_self: true }),
    examples: ['how many sites does isaac handle', 'my sites', 'which sites are under isaac'],
  },

  // ================================================================ HR RECORDS
  {
    id: 'documents', tool: 'get_document_status', group: 'Onboarding & documents',
    when: c => /\b(pan|aadhaar|aadhar|bank proof|passbook|cheque|uan|pf|esi|photo|documents?|kyc)\b/.test(c.n) && /\b(missing|not uploaded|pending|upload|uploaded|submitted|status)\b/.test(c.n),
    args: c => {
      const d = /\bpan\b/.test(c.n) ? 'pan' : /aadh?aa?r/.test(c.n) ? 'aadhaar' : /bank|passbook|cheque/.test(c.n) ? 'bank_proof' : /\b(uan|pf)\b/.test(c.n) ? 'pf_uan' : /\besi\b/.test(c.n) ? 'esi' : /photo/.test(c.n) ? 'photo' : 'any';
      return { doc_type: d, ...(c.e.person ? { candidate_name: c.e.person } : {}), ...site(c) };
    },
    examples: ['who has not uploaded PAN card', 'missing aadhaar documents', 'kavya documents status', 'pending kyc documents at nikoo homes'],
  },
  {
    id: 'onboarding', tool: 'get_onboarding_status', group: 'Onboarding & documents',
    when: t(/\b(onboarding|enrollment|enrolment|new joinees?|new joiners?|enrolled)\b/),
    args: c => ({ ...site(c), ...period(c), status: /\bpending|not verified|unverified\b/.test(c.n) ? 'not_verified' : /\bverified\b/.test(c.n) ? 'verified' : /\bdraft|incomplete\b/.test(c.n) ? 'draft' : /\brejected\b/.test(c.n) ? 'rejected' : 'any' }),
    examples: ['pending onboarding status', 'onboarding at brigade cornerstone utopia', 'new joinees this month', 'rejected onboarding forms'],
  },
  {
    id: 'recruitment', tool: 'get_recruitment_pipeline', group: 'Onboarding & documents',
    when: t(/\b(recruitment|candidates?|referrals?|hiring|offer letters?|appointment letters?)\b/),
    args: c => ({ ...period(c), ...(/\boffer\b/.test(c.n) ? { stage: 'offer' } : /\bjoined\b/.test(c.n) ? { stage: 'joined' } : {}) }),
    examples: ['recruitment pipeline', 'how many candidates in offer stage', 'candidate referrals this month'],
  },
  {
    id: 'performance', tool: 'get_performance_scores', group: 'Performance',
    when: t(/\b(score|scores|performance|ranking|rank|performers?)\b/),
    args: c => ({
      ...(c.e.person ? { person_name: c.e.person } : c.e.self ? { about_self: true } : { ranking: /\b(worst|bottom|lowest)\b/.test(c.n) ? 'bottom' : 'top' }),
      ...(/\btop (\d+)\b/.test(c.n) ? { limit: +c.n.match(/\btop (\d+)\b/)![1] } : {}), ...period(c),
    }),
    examples: ['my performance score', 'isaac score', 'top 5 performers this month', 'worst performers'],
  },

  // ================================================================ ATTENDANCE (teams / sites / exceptions)
  {
    id: 'unlock_requests', tool: 'get_attendance_requests', group: 'Attendance',
    when: t(/\b(unlock|corrections?|regularization|regularisation)\b/),
    args: c => ({ ...period(c), status: /\bpending|waiting\b/.test(c.n) ? 'pending' : /\bapproved\b/.test(c.n) ? 'approved' : /\brejected\b/.test(c.n) ? 'rejected' : 'all',
      request_type: /unlock/.test(c.n) ? 'unlock' : /correction|regulari/.test(c.n) ? 'correction' : 'all', ...(c.e.person ? { person_name: c.e.person } : {}) }),
    examples: ['pending unlock requests', 'attendance corrections this month', 'approved unlock requests last week'],
  },
  {
    id: 'exceptions', tool: 'get_attendance_exceptions', group: 'Attendance',
    when: t(/\b(late|late comers?|latecomers|came late|missed punch|no punch out|not punched out|forgot to punch out|geo ?fence|geofence|violations?|outside site)\b/),
    args: c => ({
      ...(c.e.person ? { person_name: c.e.person } : c.e.self ? { about_self: true } : {}), ...site(c), ...period(c, 'today'),
      exception_type: /\blate\b/.test(c.n) ? 'late' : /punch out|punched out|missed punch/.test(c.n) ? 'missed_punch_out' : /geo ?fence|outside site/.test(c.n) ? 'geo_fence' : 'all',
    }),
    examples: ['late comers yesterday', 'late comers today', 'who missed punch out this week', 'geo fence violations this month'],
  },
  {
    id: 'headcount', tool: 'get_site_attendance_today', group: 'Attendance',
    when: c => !c.e.person && (/\b(who|how many|headcount|head count|count|list)\b/.test(c.n) && /\b(present|absent|not punched|not come|not came|punched in|on duty|attendance)\b/.test(c.n)
      || /\bhead ?count\b/.test(c.n)
      || /\b(attendance) (at|of|in) /.test(c.n) && !!c.e.site),
    args: c => ({ ...site(c), ...(c.p.single ? period(c) : { period: 'today' }) }),
    examples: ['who is absent today', 'how many present at nikoo homes today', 'who has not punched in today', 'headcount yesterday'],
  },

  // ================================================================ OPS
  {
    id: 'devices', tool: 'get_device_status', group: 'Devices',
    when: t(/\b(biometric|device|devices|machine|machines|cctv|camera|cameras)\b/),
    args: c => ({ ...site(c), device_type: /cctv|camera/.test(c.n) ? 'cctv' : /biometric|machine/.test(c.n) ? 'biometric' : 'all',
      status_filter: /\b(offline|down|not working|dead|disconnected)\b/.test(c.n) ? 'offline' : /\bonline\b/.test(c.n) ? 'online' : 'all' }),
    examples: ['which biometric devices are offline', 'biometric machines at nikoo homes', 'cctv status'],
  },
  {
    id: 'tickets', tool: 'get_tickets', group: 'Helpdesk',
    when: t(/\b(tickets?|helpdesk|help desk|complaints?)\b/),
    args: c => ({ status: /\b(closed|resolved)\b/.test(c.n) ? 'closed' : /\ball\b/.test(c.n) ? 'all' : 'open', ...(c.e.person ? { person_name: c.e.person } : /\bmy\b/.test(c.n) ? { about_self: true } : {}),
      ...(/\burgent\b/.test(c.n) ? { priority: 'Urgent' } : /\bhigh\b/.test(c.n) ? { priority: 'High' } : {}), ...period(c) }),
    examples: ['open helpdesk tickets', 'my tickets', 'urgent tickets', 'closed tickets this month'],
  },
  {
    id: 'escalation', tool: 'get_escalation_contacts', group: 'Escalation',
    when: t(/\b(escalate|escalation|whom (should|to|do) i (call|contact|inform)|who (should|do) i (call|contact|inform)|emergency contact|sla|tat)\b/),
    args: c => ({ ...site(c), issue: (c.n.match(/\b(lift|elevator|water|leak|leakage|power|electric\w*|dg|generator|fire|security|plumbing|housekeeping|stp|wtp|pump)\b/) ?? [])[0] ?? 'general' }),
    examples: ['whom should I escalate a lift breakdown to', 'escalation contacts for nikoo homes 1', 'who should i call for water leakage'],
  },
  {
    id: 'ops_approvals', tool: 'get_ops_approvals', group: 'Approvals',
    when: c => /\bapprovals?\b/.test(c.n) && !LEAVE.test(c.n),
    args: c => ({ status: /\bapproved\b/.test(c.n) ? 'approved' : /\brejected\b/.test(c.n) ? 'rejected' : /\ball\b/.test(c.n) ? 'all' : 'pending',
      mine: /\b(for me|my approval|i need to approve|waiting for me)\b/.test(c.n) ? 'to_approve' : /\b(i raised|my requests)\b/.test(c.n) ? 'requested' : 'any', ...period(c) }),
    examples: ['pending approvals', 'approvals waiting for me', 'rejected approvals this month'],
  },
  {
    id: 'audits', tool: 'get_audits', group: 'Audits & checklists',
    when: c => /\b(audit|audits|ppm|checklist|checklists|ht yard)\b/.test(c.n) && NOT_AUDIT_TRAIL(c),
    args: c => ({ ...site(c), audit_type: /ht yard/.test(c.n) ? 'ht_yard' : /ppm/.test(c.n) ? 'ppm' : /checklist/.test(c.n) ? 'checklist' : 'all',
      ...((c.n.match(/\b(stp|wtp|dg|generator|lift|pump)\b/) ?? [])[0] ? { asset: c.n.match(/\b(stp|wtp|dg|generator|lift|pump)\b/)![0] } : {}) }),
    examples: ['latest ht yard audit', 'ppm checklists', 'audits at purva zenium'],
  },
  {
    id: 'gate', tool: 'get_gate_activity', group: 'Gate',
    when: t(/\b(visitors?|gate entries|gate entry|gate pass|gate)\b/),
    args: c => ({ ...site(c), ...period(c, 'today') }),
    examples: ['visitors today', 'gate entries at kolte patil this month'],
  },
  {
    id: 'weather', tool: 'get_weather_alerts', group: 'Weather',
    when: t(/\b(weather|rain|storm|flood|heat ?wave)\b/),
    args: c => ({ ...site(c), ...period(c) }),
    examples: ['weather alerts', 'any rain alert this week'],
  },

  // ================================================================ CRM / COMMS
  {
    id: 'crm_followups', tool: 'get_crm_followups', group: 'CRM',
    when: t(/\bfollow ?ups?\b/),
    args: c => ({ when: /\boverdue|missed|pending\b/.test(c.n) ? 'overdue' : /\btoday\b/.test(c.n) ? 'today' : /\bthis week\b/.test(c.n) ? 'this_week' : /\bnext|upcoming\b/.test(c.n) ? 'upcoming' : 'all_pending',
      ...(/\bmy\b/.test(c.n) ? { owner_name: 'me' } : {}) }),
    examples: ['overdue crm follow ups', 'follow ups today', 'my follow ups this week'],
  },
  {
    id: 'crm_pipeline', tool: 'get_crm_pipeline', group: 'CRM',
    when: t(/\b(crm|leads?|sales pipeline|pipeline|quotations?|deals?|won|lost deals?)\b/),
    args: c => ({ ...((c.n.match(/\b(negotiation|proposal|won|lost|open|new|site visit|contacted)\b/) ?? [])[0] ? { stage: c.n.match(/\b(negotiation|proposal|won|lost|open|new|site visit|contacted)\b/)![0] } : {}),
      ...(/\bmy\b/.test(c.n) ? { owner_name: 'me' } : {}), ...(c.p.period ? period(c) : {}) }),
    examples: ['crm leads by stage', 'leads in proposal stage', 'how many leads won this year', 'my leads'],
  },
  {
    id: 'comms', tool: 'get_communication_log', group: 'Communication logs',
    when: c => hasWho(c) && /\b(email|mail|notification|notifications|sms|message|messages|calls?)\b/.test(c.n) && /\b(sent|send|received|got|log|history|delivered)\b/.test(c.n),
    args: c => ({ ...who(c), ...period(c), channel: /\bemail|mail\b/.test(c.n) ? 'email' : /notification/.test(c.n) ? 'notification' : /\bcalls?\b/.test(c.n) ? 'call' : 'all',
      ...((c.n.match(/\b(payslip|salary slip|offer|appointment|attendance report|reminder|birthday)\b/) ?? [])[0] ? { topic: c.n.match(/\b(payslip|salary slip|offer|appointment|attendance report|reminder|birthday)\b/)![0] } : {}) }),
    examples: ['was the payslip email sent to kavya m', 'notifications sent to isaac yesterday', 'my email history'],
  },
  // ================================================================ PEOPLE / DIRECTORY
  {
    id: 'employee_profile', tool: 'get_employee_profile', group: 'Employee directory',
    when: c => !!c.e.person && /\b(manager|reporting|reports to|phone|number|mobile|contact|email|joining|joined|join|designation|role|profile|details|who is|employee code|status)\b/.test(c.n),
    args: c => ({
      person_name: c.e.person,
      fields: [/manager|reporting|reports to/.test(c.n) && 'manager', /phone|number|mobile|contact/.test(c.n) && 'phone', /email/.test(c.n) && 'email',
        /joining|joined|join/.test(c.n) && 'joining_date', /designation|role/.test(c.n) && 'role'].filter(Boolean),
    }),
    examples: ['who is isaac reporting manager', 'isaac phone number', 'when did kavya m join', 'isaac profile'],
  },
  {
    id: 'reports_to_me', tool: 'count_employees', group: 'Employee directory',
    when: t(/\b(who reports to me|my (team|reportees|direct reports|team members|staff)|people under me|my subordinates)\b/),
    args: () => ({ reports_to_me: true }),
    examples: ['who reports to me', 'my team members', 'my direct reports'],
  },
  {
    id: 'count_employees', tool: 'count_employees', group: 'Employee directory',
    when: c => /\b(how many|count of|number of|total|list (of )?all)\b/.test(c.n) && /\b(employees|staff|people|site managers?|field officers?|field staff|operation managers?|ops managers?|technicians?|plumbers?|electricians?|hr|users|guards?|supervisors?)\b/.test(c.n)
      && !/\b(present|absent|leave|late|punch|days)\b/.test(c.n),
    args: c => {
      const m = c.n.match(/\b(site managers?|field officers?|field staff|operation managers?|ops managers?|technicians?|plumbers?|electricians?|hr|guards?|supervisors?|technical supervisors?)\b/);
      return { ...(m ? { role: m[1].replace(/s$/, '').replace(/^ops /, 'operation ') } : {}), ...site(c), ...(/\b(left|resigned|exited)\b/.test(c.n) ? { status: 'left' } : {}) };
    },
    examples: ['how many site managers do we have', 'how many employees', 'total field staff', 'number of field officers'],
  },

];
