// eslint-disable-next-line @typescript-eslint/no-require-imports
const navigationBarPlugin = require('../plugins/with-android-navigation-bar');

const { assignNavigationBarStyles, upsertBool, upsertColor } = navigationBarPlugin;

type AndroidStyle = {
  $: { name: string; parent?: string };
  item?: Array<{ $: { name: string }; _: string }>;
};

const getStyle = (
  styles: { resources: { style: AndroidStyle[] } },
  name: string,
): AndroidStyle | undefined => styles.resources.style.find((style) => style.$.name === name);

const countStyleItems = (style: AndroidStyle | undefined, name: string, value: string): number =>
  style?.item?.filter((item) => item.$.name === name && item._ === value).length ?? 0;

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

  it('throws on malformed input instead of destroying it', () => {
    expect(() => upsertColor('not xml', 'vinesight_navigation_bar', '#2E342F')).toThrow(
      /not a recognizable/,
    );
  });

  it('normalizes an empty/whitespace file to a fresh resources document (non-destructive)', () => {
    const output = upsertColor('   \n  ', 'vinesight_navigation_bar', '#2E342F');

    expect(output).toContain('<resources>');
    expect(output).toContain('<color name="vinesight_navigation_bar">#2E342F</color>');
  });

  it.each(['<resources>', '</resources>'])(
    'throws when the resources document only contains %s',
    (input) => {
      expect(() => upsertColor(input, 'vinesight_navigation_bar', '#2E342F')).toThrow(
        /not a recognizable/,
      );
    },
  );

  it('removes a prior entry whose name attribute is preceded by another attribute (no duplicate)', () => {
    const input = [
      '<resources>',
      '  <color format="hex" name="vinesight_navigation_bar">#000000</color>',
      '</resources>',
    ].join('\n');

    const output = upsertColor(input, 'vinesight_navigation_bar', '#2E342F');

    const matches = output.match(/<color\b[^>]*\bname=["']vinesight_navigation_bar["']/g) || [];
    expect(matches).toHaveLength(1);
    expect(output).not.toContain('#000000');
    expect(output).toContain('<color name="vinesight_navigation_bar">#2E342F</color>');
  });

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

  it('assigns the AppTheme navigation bar color and button style resources', () => {
    const styles: { resources: { style: AndroidStyle[] } } = {
      resources: {
        style: [
          {
            $: { name: 'AppTheme', parent: 'Theme.AppCompat.DayNight.NoActionBar' },
            item: [],
          },
          {
            $: { name: 'Theme.App.SplashScreen' },
            item: [],
          },
        ],
      },
    };

    const once = assignNavigationBarStyles(styles);
    const output = assignNavigationBarStyles(once);
    const appTheme = getStyle(output, 'AppTheme');
    const splashTheme = getStyle(output, 'Theme.App.SplashScreen');

    expect(appTheme).toBeDefined();
    expect(splashTheme).toBeDefined();
    expect(
      countStyleItems(appTheme, 'android:navigationBarColor', '@color/vinesight_navigation_bar'),
    ).toBe(1);
    expect(
      countStyleItems(
        appTheme,
        'android:windowLightNavigationBar',
        '@bool/vinesight_light_navigation_bar',
      ),
    ).toBe(1);
    expect(
      countStyleItems(
        splashTheme,
        'android:windowLightNavigationBar',
        '@bool/vinesight_light_navigation_bar',
      ),
    ).toBe(1);
    expect(
      appTheme?.item?.filter((item) => item.$.name === 'android:navigationBarColor'),
    ).toHaveLength(1);
    expect(
      appTheme?.item?.filter((item) => item.$.name === 'android:windowLightNavigationBar'),
    ).toHaveLength(1);
    expect(
      splashTheme?.item?.filter((item) => item.$.name === 'android:windowLightNavigationBar'),
    ).toHaveLength(1);
  });
});
