/* eslint-disable @typescript-eslint/no-require-imports */
const {
  withAndroidColors,
  withAndroidStyles,
  withDangerousMod,
  AndroidConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Theme-aware Android system navigation bar background color.
 *
 * WHY: expo-navigation-bar v57 only exposes the nav-bar *background* through
 * the static `navigationBar.backgroundColor` config — a single value applied
 * to both light and dark. Vinesight has distinct backgrounds (#FBF8F3 light /
 * #121613 dark), so one color can't contrast both. That's why the bar was set
 * to `transparent`, which (with enforceContrast disabled) made it visually
 * merge into the app background — hard to tell the gesture area apart from
 * app content.
 *
 * WHAT: defines a `<color>` resource in `values/` (light) and `values-night/`
 * (dark) and points `android:navigationBarColor` at it. AppTheme is
 * Theme.AppCompat.DayNight, so Android picks the right tone per device theme —
 * including during the splash / cold start, before JS loads. The button tint
 * (windowLightNavigationBar) stays driven at runtime by the <NavigationBar>
 * component in app/_layout.tsx.
 *
 * Tones use the M3 surfaceContainer ramp. The bottom tab bar sits at
 * `surfaceContainer` (surface[200]) — per the M3 NavigationBar spec
 * (m3.material.io/components/navigation-bar/specs) — so the system bar takes
 * the next rung up, `surfaceContainerHigh` (surface[300]). That keeps a clean
 * 3-step ramp — bg surface[50] → tab bar surface[200] → system bar surface[300]
 * — so each layer is clearly distinct from the app background in both themes.
 */
const COLOR_NAME = 'vinesight_navigation_bar';
const LIGHT_BUTTONS_NAME = 'vinesight_light_navigation_bar';
const LIGHT_COLOR = '#D9D0C4'; // surface[300] / surfaceContainerHigh — light
const DARK_COLOR = '#2E342F'; // surface[300] / surfaceContainerHigh — dark

const withAndroidNavigationBarColor = (config) => {
  // 1. Light-mode color resource → values/colors.xml
  config = withAndroidColors(config, (cfg) => {
    cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, {
      name: COLOR_NAME,
      value: LIGHT_COLOR,
    });
    return cfg;
  });

  // 2. Dark-mode color resource → values-night/colors.xml. Expo has no built-in
  //    night-colors mod, so edit the file directly (idempotent — safe to re-run).
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const resDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      const nightColorsPath = path.join(resDir, 'values-night', 'colors.xml');
      const boolsPath = path.join(resDir, 'values', 'bools.xml');
      const nightBoolsPath = path.join(resDir, 'values-night', 'bools.xml');
      const nightStylesPath = path.join(resDir, 'values-night', 'styles.xml');

      let contents;
      try {
        contents = fs.readFileSync(nightColorsPath, 'utf8');
      } catch {
        contents = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>';
      }

      contents = upsertColor(contents, COLOR_NAME, DARK_COLOR);

      const bools = upsertBool(readResourceFile(boolsPath), LIGHT_BUTTONS_NAME, 'true');
      const nightBools = upsertBool(readResourceFile(nightBoolsPath), LIGHT_BUTTONS_NAME, 'false');
      const nightStyles = upsertStyleItem(
        readResourceFile(nightStylesPath),
        'AppTheme',
        'android:windowLightNavigationBar',
        'false',
      );

      // Let filesystem failures abort prebuild. Continuing would leave the
      // generated style pointing at a missing night resource and turn the real
      // error into a much less actionable Android resource-link failure.
      fs.mkdirSync(path.dirname(nightColorsPath), { recursive: true });
      fs.writeFileSync(nightColorsPath, contents);
      fs.writeFileSync(boolsPath, bools);
      fs.writeFileSync(nightBoolsPath, nightBools);
      fs.writeFileSync(nightStylesPath, nightStyles);

      return cfg;
    },
  ]);

  // 3. Point AppTheme.android:navigationBarColor at the resource. Overwrites
  //    any literal color (and is itself idempotent), so it stays correct even
  //    if the static config or another plugin writes the same attribute.
  config = withAndroidStyles(config, (cfg) => {
    cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:navigationBarColor',
      value: `@color/${COLOR_NAME}`,
    });
    cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
      add: true,
      parent: { name: 'Theme.App.SplashScreen' },
      name: 'android:windowLightNavigationBar',
      value: `@bool/${LIGHT_BUTTONS_NAME}`,
    });
    return cfg;
  });

  return config;
};

/**
 * Insert or replace a single `<color name="...">value</color>` entry inside a
 * `<resources>` block. Used for values-night/colors.xml, where a direct string
 * edit is simpler than re-parsing Expo's resource JSON. `name` must be a
 * regex-safe identifier (only word chars / underscores).
 */
function upsertColor(contents, name, value) {
  return upsertResource(contents, 'color', name, value);
}

function upsertBool(contents, name, value) {
  return upsertResource(contents, 'bool', name, value);
}

function upsertResource(contents, tag, name, value) {
  // Drop any prior entry so repeated prebuilds don't accumulate duplicates.
  contents = contents.replace(
    new RegExp('\\s*<' + tag + '\\s+name="' + name + '"[^>]*>[^<]*<\\/' + tag + '>', 'g'),
    '',
  );

  if (!/<resources[\s>]/.test(contents) || !/<\/resources>/.test(contents)) {
    contents = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>';
  }

  const entry = `  <${tag} name="${name}">${value}</${tag}>`;
  return contents.replace('</resources>', `${entry}\n</resources>`);
}

function readResourceFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>';
  }
}

function upsertStyleItem(contents, styleName, itemName, value) {
  const escapedStyleName = styleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stylePattern = new RegExp(
    `(<style\\b[^>]*\\bname=["']${escapedStyleName}["'][^>]*>)([\\s\\S]*?)(</style>)`,
  );
  const match = contents.match(stylePattern);
  if (!match) {
    const style = `  <style name="${styleName}">\n    <item name="${itemName}">${value}</item>\n  </style>`;
    return contents.replace('</resources>', `${style}\n</resources>`);
  }

  const itemPattern = new RegExp(`\\s*<item\\s+name=["']${itemName}["'][^>]*>[^<]*<\\/item>`, 'g');
  const body = match[2].replace(itemPattern, '');
  const item = `\n    <item name="${itemName}">${value}</item>`;
  return contents.replace(stylePattern, `${match[1]}${body}${item}\n  ${match[3]}`);
}

withAndroidNavigationBarColor.upsertColor = upsertColor;
withAndroidNavigationBarColor.upsertBool = upsertBool;
withAndroidNavigationBarColor.upsertStyleItem = upsertStyleItem;

module.exports = withAndroidNavigationBarColor;
