import { csvCell, toCsv } from './csv';

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('plain')).toBe('plain');
  });

  it.each(['=SUM(A1)', '+91 98765', '-1+1', '@cmd', '\tx'])('neutralises spreadsheet formulas: %j', (v) => {
    expect(csvCell(v).replace(/^"/, '')).toMatch(/^'/);
  });

  it('keeps ordinary values untouched and renders null/undefined as empty', () => {
    expect(csvCell('anaya@example.com')).toBe('anaya@example.com');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(42)).toBe('42');
  });

  it('builds rows with CRLF endings', () => {
    expect(toCsv(['email', 'joined'], [['a@x.in', '2026-10-01']])).toBe('email,joined\r\na@x.in,2026-10-01\r\n');
  });
});
