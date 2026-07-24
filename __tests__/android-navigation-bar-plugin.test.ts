// eslint-disable-next-line @typescript-eslint/no-require-imports
const navigationBarPlugin = require('../plugins/with-android-navigation-bar');

const { upsertBool, upsertColor } = navigationBarPlugin;

/** Count `<tag name="name"` / `<tag name='name'` occurrences (either quote). */
const countEntries = (xml: string, tag: string, name: string): number =>
  (xml.match(new RegExp(`<${tag}\\s+name=["']${name}["']`, 'g')) || []).length;

describe('with-android-navigation-bar', () => {
  it('adds the color resource and remains idempotent', () => {
    const input = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>';

    const once = upsertColor(input, 'vinesight_navigation_bar', '#2E342F');
    const twice = upsertColor(once, 'vinesight_navigation_bar', '#2E342F');

    expect(twice).toBe(once);
    expect(countEntries(twice, 'color', 'vinesight_navigation_bar')).toBe(1);
    expect(twice).toContain('<resources>');
    expect(twice).toContain('</resources>');
  });

  it('replaces an existing resource value without disturbing other colors', () => {
    const input = [
      '<resources>',
      '  <color name="other">#FFFFFF</color>',
      '  <color name="vinesight_navigation_bar">#000000</color>',
      '</resources>',
    ].join('\n');

    const once = upsertColor(input, 'vinesight_navigation_bar', '#2E342F');
    const twice = upsertColor(once, 'vinesight_navigation_bar', '#2E342F');

    expect(twice).toBe(once);
    expect(countEntries(twice, 'color', 'vinesight_navigation_bar')).toBe(1);
    expect(twice).toContain('<color name="other">#FFFFFF</color>');
    expect(twice).toContain('<color name="vinesight_navigation_bar">#2E342F</color>');
    expect(twice).not.toContain('#000000');
  });

  it('recovers from malformed input with a valid resources document', () => {
    const output = upsertColor('not xml', 'vinesight_navigation_bar', '#2E342F');

    expect(output).toBe(
      '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="vinesight_navigation_bar">#2E342F</color>\n</resources>',
    );
  });

  it.each(['<resources>', '</resources>'])(
    'recovers when the resources document only contains %s',
    (input) => {
      const output = upsertColor(input, 'vinesight_navigation_bar', '#2E342F');

      expect(output).toContain('<resources>');
      expect(output).toContain('</resources>');
      expect(countEntries(output, 'color', 'vinesight_navigation_bar')).toBe(1);
    },
  );

  it('dedupes a single-quoted existing entry and writes it back with double quotes', () => {
    const input = `<resources>\n  <color name='vinesight_navigation_bar'>#000000</color>\n</resources>`;

    const output = upsertColor(input, 'vinesight_navigation_bar', '#2E342F');

    expect(countEntries(output, 'color', 'vinesight_navigation_bar')).toBe(1);
    expect(output).not.toContain('#000000');
    expect(output).not.toContain("name='vinesight_navigation_bar'");
    expect(output).toContain('<color name="vinesight_navigation_bar">#2E342F</color>');
  });

  it('preserves resources when the closing tag contains whitespace', () => {
    const input = '<resources>\n  <color name="other">#FFFFFF</color>\n</resources >';

    const output = upsertColor(input, 'vinesight_navigation_bar', '#2E342F');

    expect(output).toContain('<color name="other">#FFFFFF</color>');
    expect(output).toContain('<color name="vinesight_navigation_bar">#2E342F</color>');
    expect(output).toContain('</resources>');
  });

  it('writes a boolean resource and remains idempotent', () => {
    const input = '<resources>\n</resources>';

    const once = upsertBool(input, 'vinesight_light_navigation_bar', 'true');
    const twice = upsertBool(once, 'vinesight_light_navigation_bar', 'true');

    expect(twice).toBe(once);
    expect(countEntries(twice, 'bool', 'vinesight_light_navigation_bar')).toBe(1);
    expect(twice).toContain('<bool name="vinesight_light_navigation_bar">true</bool>');
  });
});
