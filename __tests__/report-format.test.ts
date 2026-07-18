import { escapeCSV, escapeHtml } from '@/services/report/report-format';

describe('escapeCSV', () => {
  it('returns simple values unchanged', () => {
    expect(escapeCSV('hello')).toBe('hello');
    expect(escapeCSV('123')).toBe('123');
    expect(escapeCSV('')).toBe('');
  });

  it('wraps and doubles embedded double quotes', () => {
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
  });

  it('wraps values containing a comma', () => {
    expect(escapeCSV('a,b')).toBe('"a,b"');
  });

  it('wraps values containing a newline', () => {
    expect(escapeCSV('line1\nline2')).toBe('"line1\nline2"');
  });

  it('wraps values containing a carriage return (RFC 4180)', () => {
    expect(escapeCSV('line1\rline2')).toBe('"line1\rline2"');
    expect(escapeCSV('a\rb')).toBe('"a\rb"');
    expect(escapeCSV('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('does not double-quote values lacking special characters', () => {
    expect(escapeCSV('plain-text 123')).toBe('plain-text 123');
  });

  it('guards against formula injection by prefixing formula starters', () => {
    // Formula guard prefixes ' AND wraps the whole value in double quotes.
    expect(escapeCSV('=SUM(A1)')).toBe('"\'=SUM(A1)"');
    expect(escapeCSV('=SUM(A1)')).toMatch(/^"'/);
    // Each formula-prefix character triggers the guard
    expect(escapeCSV('+1')).toBe('"\'+1"');
    expect(escapeCSV('-1')).toBe('"\'-1"');
    expect(escapeCSV('@foo')).toBe('"\'@foo"');
    expect(escapeCSV('\tcell')).toBe('"\'\tcell"');
    expect(escapeCSV('\rmalicious')).toBe('"\'\rmalicious"');
  });

  it('escapes embedded double quotes even when the value starts with a formula char', () => {
    // = triggers formula guard (prefix '), then quotes are doubled and wrapped in quotes.
    const expected = '"' + "'=" + '""' + 'evil' + '""' + '"';
    expect(escapeCSV('="evil"')).toBe(expected);
  });
});

describe('escapeHtml', () => {
  it('escapes all HTML metacharacters', () => {
    expect(escapeHtml('<script>alert("&")</script>')).toBe(
      '&lt;script&gt;alert(&quot;&amp;&quot;)&lt;/script&gt;',
    );
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });
});
