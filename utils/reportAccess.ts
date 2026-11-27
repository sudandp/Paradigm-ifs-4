/**
 * Shared helpers for passcode-gated report access (ops_approval_requests, module 'ReportAccess').
 * Attendance reports use fixed record UUIDs per report type; onboarding export uses its own.
 */

/** Fixed record_id used for "Onboarding Submissions Export" access requests. */
export const ONBOARDING_EXPORT_RECORD_ID = '88888888-8888-8888-8888-888888888888';

/** How long an unlocked export stays valid after the passcode is entered. */
export const REPORT_UNLOCK_WINDOW_MS = 2 * 60 * 60 * 1000;

export const extractPasscode = (comments?: string | null): string => {
  if (!comments) return '';
  const match = comments.match(/Passcode:\s*(\d{6})/i);
  return match ? match[1] : '';
};

export const generateDeterministicPasscode = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000000).toString().padStart(6, '0');
};

/**
 * Split stored comments into parts. Formats written by approvers:
 *   pending:  "<reason>"
 *   approved: "Passcode: 123456 | Reason: <reason>"
 *   rejected: "<rejection note> | Reason: <reason>"
 */
export const parseAccessComments = (
  comments: string | null | undefined,
  status: 'Pending' | 'Approved' | 'Rejected'
): { reason: string; passcode: string; reviewerNote: string } => {
  const text = (comments || '').trim();
  const passcode = extractPasscode(text);
  if (status === 'Pending') return { reason: text, passcode: '', reviewerNote: '' };
  const [head, ...rest] = text.split(/\s*\|\s*Reason:\s*/i);
  const reason = rest.join(' | ').trim();
  const reviewerNote = status === 'Rejected' ? head.trim() : '';
  return { reason, passcode, reviewerNote };
};

/** Where the requester should land after approval/rejection of a ReportAccess request. */
export const getReportAccessLink = (recordId?: string | null): string =>
  recordId === ONBOARDING_EXPORT_RECORD_ID ? '/verification/dashboard' : '/attendance/dashboard';
