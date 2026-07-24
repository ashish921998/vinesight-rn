// eslint-disable-next-line @typescript-eslint/no-require-imports
const navigationBarPlugin = require('../plugins/with-android-navigation-bar');

const { upsertBool, upsertColor, upsertStyleItem } = navigationBarPlugin;

describe('with-android-navigation-bar', () => {
  it('adds the color resource and remains idempotent', () => {
    const input = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>';

    const once = upsertColor(input, 'vinesight_navigation_bar', '#2E342F');
    const twice = upsertColor(once, 'vinesight_navigation_bar', '#2E342F');

    expect(twice).toBe(once);
    expect(twice.match(/name="vinesight_navigation_bar"/g)).toHaveLength(1);
  });

  it('replaces an existing resource value without disturbing other colors', () => {
    const input = [
      '<resources>',
      '  <color name="other">#FFFFFF</color>',
      '  <color name="vinesight_navigation_bar">#000000</color>',
      '</resources>',
    ].join('\n');

    const output = upsertColor(input, 'vinesight_navigation_bar', '#2E342F');

    expect(output).toContain('<color name="other">#FFFFFF</color>');
    expect(output).toContain('<color name="vinesight_navigation_bar">#2E342F</color>');
    expect(output).not.toContain('#000000');
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
      expect(output).toContain('<color name="vinesight_navigation_bar">#2E342F</color>');
    },
  );

  it('writes a boolean resource for the cold-start button appearance', () => {
    const output = upsertBool(
      '<resources>\n</resources>',
      'vinesight_light_navigation_bar',
      'true',
    );

    expect(output).toContain('<bool name="vinesight_light_navigation_bar">true</bool>');
  });

  it('sets the cold-start button appearance on an existing Android theme', () => {
    const output = upsertStyleItem(
      '<resources>\n  <style name="AppTheme"></style>\n</resources>',
      'AppTheme',
      'android:windowLightNavigationBar',
      '@bool/vinesight_light_navigation_bar',
    );

    expect(output).toContain(
      '<item name="android:windowLightNavigationBar">@bool/vinesight_light_navigation_bar</item>',
    );
  });
});
