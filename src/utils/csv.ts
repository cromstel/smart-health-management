/**
 * Utility functions for exporting tabular data into CSV format
 */

export function exportToCSV<T extends Record<string, any>>(
  filename: string,
  data: T[],
  headersMap?: { [K in keyof T]?: string } | { key: keyof T; label: string }[]
): void {
  if (!data || data.length === 0) {
    throw new Error('No data available to export');
  }

  let columns: { key: string; label: string }[] = [];

  if (Array.isArray(headersMap)) {
    columns = headersMap.map((h) => ({ key: String(h.key), label: h.label }));
  } else if (headersMap && typeof headersMap === 'object') {
    columns = Object.entries(headersMap).map(([key, label]) => ({
      key,
      label: String(label),
    }));
  } else {
    // Default to object keys
    const sampleKeys = Object.keys(data[0]);
    columns = sampleKeys.map((k) => ({
      key: k,
      label: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    }));
  }

  const escapeCSVCell = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const headerRow = columns.map((col) => escapeCSVCell(col.label)).join(',');
  const dataRows = data.map((item) =>
    columns.map((col) => escapeCSVCell(item[col.key] ?? '')).join(',')
  );

  const csvContent = [headerRow, ...dataRows].join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.setAttribute('download', cleanFilename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
