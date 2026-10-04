import { describe, it, expect } from 'vitest';
import { escapeCsvCell, generateCsv } from '../utils/csv';

describe('CSV Escaping & Formula Injection Neutralization Tests', () => {
  describe('Formula prefix neutralization', () => {
    it('neutralizes cells starting with = by prefixing single quote', () => {
      expect(escapeCsvCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(escapeCsvCell('=1+1')).toBe("'=1+1");
      // Double quotes inside are escaped and the entire cell is wrapped in quotes
      expect(escapeCsvCell('=cmd|"/C calc"!A0')).toBe('"\'=cmd|""/C calc""!A0"');
    });

    it('neutralizes cells starting with @ by prefixing single quote', () => {
      expect(escapeCsvCell('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
      expect(escapeCsvCell('@import(url)')).toBe("'@import(url)");
    });

    it('neutralizes cells starting with tab (\\t) by prefixing single quote', () => {
      const tabPrefixed = '\t=1+1';
      expect(escapeCsvCell(tabPrefixed)).toBe("'\t=1+1");
    });

    it('neutralizes cells starting with carriage return (\\r)', () => {
      const crPrefixed = '\r=1+1';
      const escaped = escapeCsvCell(crPrefixed);
      // Contains \r so it will be formula neutralized and quoted
      expect(escaped).toBe('"\'\r=1+1"');
    });

    it('neutralizes text starting with + or - when not a genuine numeric value', () => {
      expect(escapeCsvCell('+cmd|"/C calc"!A0')).toBe('"\'+cmd|""/C calc""!A0"');
      expect(escapeCsvCell('-calc()')).toBe("'-calc()");
      expect(escapeCsvCell('+1+1')).toBe("'+1+1");
      expect(escapeCsvCell('-2+3')).toBe("'-2+3");
    });

    it('preserves genuine positive and negative numbers without formula quotes', () => {
      expect(escapeCsvCell(-184.99)).toBe('-184.99');
      expect(escapeCsvCell(-196)).toBe('-196');
      expect(escapeCsvCell(42.5)).toBe('42.5');
      expect(escapeCsvCell(0)).toBe('0');
      expect(escapeCsvCell('+42.5')).toBe('+42.5');
      expect(escapeCsvCell('-185.00')).toBe('-185.00');
    });
  });

  describe('Delimiter, quote, and newline escaping', () => {
    it('quotes strings containing commas', () => {
      expect(escapeCsvCell('LN2, LOX, Argon')).toBe('"LN2, LOX, Argon"');
    });

    it('escapes and doubles internal double quotes', () => {
      expect(escapeCsvCell('CryoTank "Primary" Alpha')).toBe('"CryoTank ""Primary"" Alpha"');
    });

    it('quotes strings containing newline characters (\\n and \\r\\n)', () => {
      expect(escapeCsvCell('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
      expect(escapeCsvCell('Line 1\r\nLine 2')).toBe('"Line 1\r\nLine 2"');
    });

    it('handles combined commas, quotes, and newlines correctly', () => {
      const complex = 'Item: "Valve",\nStatus: Active';
      expect(escapeCsvCell(complex)).toBe('"Item: ""Valve"",\nStatus: Active"');
    });

    it('handles null, undefined, and empty values gracefully', () => {
      expect(escapeCsvCell(null)).toBe('');
      expect(escapeCsvCell(undefined)).toBe('');
      expect(escapeCsvCell('')).toBe('');
    });

    it('formats Date objects as ISO strings', () => {
      const date = new Date('2026-10-04T12:00:00.000Z');
      expect(escapeCsvCell(date)).toBe('2026-10-04T12:00:00.000Z');
    });
  });

  describe('Full CSV document generation & UTF-8 BOM', () => {
    it('prepends UTF-8 BOM (\\uFEFF) to the generated CSV document', () => {
      const headers = ['Tank Code', 'Temperature (°C)', 'Notes'];
      const rows = [
        ['C-001', -192.5, 'Normal nominal operation'],
        ['C-002', -184.99, 'Exceeded threshold, check valve'],
        ['C-003', -179.5, '=SUM(1,2)'],
      ];

      const csv = generateCsv(headers, rows);

      // Verify BOM is the first character
      expect(csv.charCodeAt(0)).toBe(0xfeff);
      expect(csv.startsWith('\uFEFF')).toBe(true);

      // Verify header line
      expect(csv).toContain('Tank Code,Temperature (°C),Notes');

      // Verify numeric cell is unquoted
      expect(csv).toContain('C-001,-192.5,Normal nominal operation');

      // Verify comma in notes is properly quoted
      expect(csv).toContain('C-002,-184.99,"Exceeded threshold, check valve"');

      // Verify formula injection with comma inside is neutralized and properly quoted
      expect(csv).toContain('C-003,-179.5,"\'=SUM(1,2)"');
    });
  });
});
