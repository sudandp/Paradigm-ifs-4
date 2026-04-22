/**
 * Export Engine Utility
 * Supports exporting JSON data arrays to CSV format.
 */

export const exportToCSV = (data: any[], filename: string) => {
  if (!data || !data.length) return;

  // 1. Extract Headers from the first object
  const headers = Object.keys(data[0]);

  // 2. Build CSV Content
  const csvRows = [];
  // Add header row
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header] === null || row[header] === undefined ? '' : row[header];
      // Escape strings containing commas, newlines, or quotes
      const stringVal = String(val);
      if (stringVal.includes(',') || stringVal.includes('\n') || stringVal.includes('"')) {
        return `"${stringVal.replace(/"/g, '""')}"`;
      }
      return stringVal;
    });
    csvRows.push(values.join(','));
  }

  // 3. Create Blob and Download
  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
