export const RELEASE_NOTES = {
  version: '26.8.0',
  date: '2026-11-19',
  notes: [
  "fix(users): resolve foreign key violation on field_attendance_violations during user deletion",
  "style(header): elevate SyncStatusBadge to match crisp enterprise desktop header design",
  "fix(attendance): prevent punch corrections from consuming permission pool and fix early departure auto-deductions",
  "feat(weather): auto-sync user live location with progressive GPS, profile and IP fallback",
  "fix(offline): implement atomic IDB transactions, CAS acknowledgment loop, SQLite schema migration, and accurate acceptance matrix"
]
};
