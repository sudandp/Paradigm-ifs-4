/**
 * High-performance CSV generator for large datasets.
 * Designed to handle 40,000+ rows without crashing the browser.
 */

export const exportToCsv = (filename: string, data: any[], headers: { [key: string]: string }) => {
    if (!data || data.length === 0) return;

    // Create CSV content starting with BOM for Excel compatibility
    let csvContent = '\uFEFF'; 

    // Add Headers
    const headerKeys = Object.keys(headers);
    csvContent += headerKeys.map(key => `"${String(headers[key]).replace(/"/g, '""')}"`).join(',') + '\n';

    // Add Data Rows (Batch-oriented string concatenation is faster than Array.map for massive arrays)
    const rowCount = data.length;
    for (let i = 0; i < rowCount; i++) {
        const row = data[i];
        let rowContent = '';
        for (let j = 0; j < headerKeys.length; j++) {
            const key = headerKeys[j];
            const value = row[key] === null || row[key] === undefined ? '' : row[key];
            rowContent += `"${String(value).replace(/"/g, '""')}"`;
            if (j < headerKeys.length - 1) rowContent += ',';
        }
        csvContent += rowContent + '\n';
    }

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
