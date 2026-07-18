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
