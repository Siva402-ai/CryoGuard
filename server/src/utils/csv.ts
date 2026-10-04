/**
 * CSV Generation Utility
 * Features:
 * - UTF-8 BOM (\uFEFF)
 * - Escaping and quoting for commas, quotes, and newlines
 * - Formula injection neutralization (prefixing ' on string cells starting with =, +, -, @)
 * - Safe numeric handling (does not alter genuine negative or positive numbers)
 */

export function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }

  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : '';
  }

  if (val instanceof Date) {
    return val.toISOString();
  }

  let str = String(val);

  // Neutralize formula injection for text starting with =, +, -, @
  // Only apply to non-numeric strings (e.g. keep -184.99 or +42 as plain numbers, but neutralize -cmd, +alert, =SUM, @import)
  const isFormulaChar = str.startsWith('=') || str.startsWith('@');
  const isSignPrefix = (str.startsWith('+') || str.startsWith('-')) && isNaN(Number(str));

  if (isFormulaChar || isSignPrefix) {
    str = `'${str}`;
  }

  // Quote if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function generateCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const rowLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  const csvContent = [headerLine, ...rowLines].join('\r\n');

  // Prepend UTF-8 BOM
  return `\uFEFF${csvContent}`;
}
