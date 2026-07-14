const parsePermissionDurationFromReason = (reason: string): number => {
  if (!reason) return 0;
  const text = reason.toLowerCase();
  
  // Try matching formats like "1hr 15 mints", "1 hour 15 mins", "1h 15m", "1 hr 15 mins", "1 hour 15 minutes"
  const hrMinRegex = /(\d+)\s*(?:hr|hour|h)s?\s*(\d+)\s*(?:mint|min|m)/;
  const hrMinMatch = text.match(hrMinRegex);
  if (hrMinMatch) {
    const hrs = parseInt(hrMinMatch[1], 10);
    const mins = parseInt(hrMinMatch[2], 10);
    return hrs * 60 + mins;
  }

  // Try matching only hours: "1.5 hours", "2 hours", "1hr", "1 hour", "1h"
  const hrRegex = /(\d+(?:\.\d+)?)\s*(?:hr|hour|h)/;
  const hrMatch = text.match(hrRegex);
  if (hrMatch) {
    return parseFloat(hrMatch[1]) * 60;
  }

  // Try matching only minutes: "15mints", "30 mintes", "37 minutes", "15m"
  const minRegex = /(\d+)\s*(?:mint|min|m)/;
  const minMatch = text.match(minRegex);
  if (minMatch) {
    return parseInt(minMatch[1], 10);
  }

  return 0;
};

// Test cases
const tests = [
  "need a permition for 1hr 15 mints personal reason",
  "test 15mints",
  "need to go 30 mintes early",
  "37 minutes need permission due to an emergency",
  "1.5 hours permission",
  "2 hr permission",
  "need 1 hour"
];

tests.forEach(t => {
  console.log(`"${t}" => ${parsePermissionDurationFromReason(t)} mins (${(parsePermissionDurationFromReason(t)/60).toFixed(2)} hours)`);
});
