/**
 * Formats a date string or Date object into a readable string/time
 */
export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return 'Never';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';
  
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const dayDiff = Math.floor(diff / (1000 * 3600 * 24));
  
  // If less than 24 hours ago, show relative time
  if (dayDiff === 0) {
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  }
  
  // If less than 7 days ago, show day name
  if (dayDiff < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  }
  
  // Otherwise show full date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Checks if a given date is the 3rd Saturday of the month
 */
export function isThirdSaturday(date: Date = new Date()): boolean {
  if (date.getDay() !== 6) return false; // 6 = Saturday
  const dayOfMonth = date.getDate();
  return dayOfMonth >= 15 && dayOfMonth <= 21;
}

/**
 * Formats a date string, Date object, or timestamp into DD/MM/YYYY format without timezone shifts
 * e.g. "1998-03-02" -> "02/03/1998"
 * e.g. "2026-09-01" -> "01/09/2026"
 */
export function formatDisplayDate(dateStr?: string | Date | number | null): string {
  if (!dateStr) return '-';
  if (typeof dateStr === 'string') {
    const trimmed = dateStr.trim();
    if (!trimmed || trimmed === '-' || trimmed === '—') return '-';

    // Already DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;

    // YYYY-MM-DD or YYYY/MM/DD (handles timestamps with T or space as well)
    const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }

    // DD-MM-YYYY or DD.MM.YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
  }

  if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
    const d = String(dateStr.getDate()).padStart(2, '0');
    const m = String(dateStr.getMonth() + 1).padStart(2, '0');
    const y = dateStr.getFullYear();
    return `${d}/${m}/${y}`;
  }

  return String(dateStr);
}
