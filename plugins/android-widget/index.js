/* eslint-disable @typescript-eslint/no-require-imports */
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const { getMainApplicationOrThrow } = AndroidConfig.Manifest;

/**
 * Helper function to modify Kotlin files
 */
function withMainApplicationKotlin(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const applicationPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        'com',
        'vinesight',
        'app',
        'MainApplication.kt',
      );

      if (!fs.existsSync(applicationPath)) {
        console.warn(`[android-widget] MainApplication.kt not found at: ${applicationPath}`);
        return config;
      }

      let contents;
      try {
        contents = fs.readFileSync(applicationPath, 'utf8');
      } catch (error) {
        console.warn(
          `[android-widget] Failed to read MainApplication.kt at ${applicationPath}:`,
          error,
        );
        return config;
      }

      const importStatement = 'import com.vinesight.WidgetPackage';
      const packageCall = 'add(WidgetPackage())';
      const hasImport = contents.includes(importStatement);
      const hasPackageCall = contents.includes(packageCall);

      // Check if already modified
      if (hasImport && hasPackageCall) {
        return config;
      }

      // Add import statement after the last import
      if (!hasImport) {
        const lastImportIndex = contents.lastIndexOf('\nimport ');
        if (lastImportIndex !== -1) {
          const lastImportEnd = contents.indexOf('\n', lastImportIndex + 1);
          contents =
            contents.substring(0, lastImportEnd) +
            '\n' +
            importStatement +
            contents.substring(lastImportEnd);
        }
      }

      // Add package to getPackages() method
      const packageAddition = `              ${packageCall}`;

      // Find the packages.apply block and add before the closing brace
      if (!hasPackageCall) {
        const packagesMatch = contents.match(
          /PackageList\(this\)\.packages\.apply \{[\s\S]*?\n\s*\}/m,
        );
        if (packagesMatch) {
          const applyBlock = packagesMatch[0];
          const newApplyBlock = applyBlock.replace(/(\n\s*\})$/, '\n' + packageAddition + '$1');
          contents = contents.replace(applyBlock, newApplyBlock);
        }
      }

      if (!contents.includes(importStatement) || !contents.includes(packageCall)) {
        console.warn(
          '[android-widget] Failed to safely inject WidgetPackage into MainApplication.kt. Skipping write.',
        );
        return config;
      }

      try {
        fs.writeFileSync(applicationPath, contents);
      } catch (error) {
        console.warn(
          `[android-widget] Failed to write MainApplication.kt at ${applicationPath}:`,
          error,
        );
        return config;
      }

      return config;
    },
  ]);
}

/**
 * Expo Config Plugin for Android Home Screen Widget Support
 *
 * This plugin:
 * 1. Registers WidgetPackage in MainApplication.kt
 * 2. Adds WeatherWidgetProvider receiver to AndroidManifest.xml
 */

/**
 * Copies Kotlin source files to the Android project
 */
const withKotlinSources = (config) => {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const pluginPath = path.join(__dirname, 'src/main/kotlin/com/vinesight');
      const targetPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        'com',
        'vinesight',
      );

      // Create target directory if it doesn't exist
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }

      // Copy all Kotlin files from plugin to target
      if (!fs.existsSync(pluginPath)) {
        console.warn(`[android-widget] Kotlin source directory not found: ${pluginPath}`);
        return config;
      }

      let files = [];
      try {
        files = fs.readdirSync(pluginPath);
      } catch (error) {
        console.warn(
          `[android-widget] Failed to read Kotlin source directory ${pluginPath}:`,
          error,
        );
        return config;
      }
      for (const file of files) {
        if (file.endsWith('.kt')) {
          const srcFile = path.join(pluginPath, file);
          const destFile = path.join(targetPath, file);
          try {
            fs.copyFileSync(srcFile, destFile);
          } catch (error) {
            console.warn(`[android-widget] Failed to copy ${srcFile} -> ${destFile}:`, error);
          }
        }
      }

      return config;
    },
  ]);
};

/**
 * Adds WeatherWidgetProvider receiver to AndroidManifest.xml
 */
const withWidgetReceiver = (config) => {
  return withAndroidManifest(config, (config) => {
    const { modResults } = config;
    const mainApplication = getMainApplicationOrThrow(modResults);

    // Check if receiver already exists
    const existingReceivers = mainApplication.receiver || [];
    const hasWeatherWidgetReceiver = existingReceivers.some(
      (receiver) => receiver.$?.['android:name'] === 'com.vinesight.WeatherWidgetProvider',
    );

    if (hasWeatherWidgetReceiver) {
      return config;
    }

    // Add the widget receiver
    const weatherWidgetReceiver = {
      $: {
        'android:name': 'com.vinesight.WeatherWidgetProvider',
        'android:exported': 'true',
        'android:enabled': 'true',
      },
      'intent-filter': [
        {
          action: [
            {
              $: {
                'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
              },
            },
          ],
        },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.appwidget.provider',
            'android:resource': '@xml/weather_widget_info',
          },
        },
      ],
    };

    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }
    mainApplication.receiver.push(weatherWidgetReceiver);

    return config;
  });
};

/**
 * Creates the widget XML resource file
 *
 * NOTE: XML files are only created if they don't exist. This prevents overwriting
 * user customizations, but also means template updates won't apply to existing builds.
 */
const withWidgetResources = (config) => {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const resPath = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      const xmlPath = path.join(resPath, 'xml');
      const widgetInfoPath = path.join(xmlPath, 'weather_widget_info.xml');

      // Create xml directory if it doesn't exist
      if (!fs.existsSync(xmlPath)) {
        fs.mkdirSync(xmlPath, { recursive: true });
      }

      // Create widget info XML if it doesn't exist
      if (!fs.existsSync(widgetInfoPath)) {
        const widgetInfoContent = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_weather"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen">
</appwidget-provider>`;
        fs.writeFileSync(widgetInfoPath, widgetInfoContent);
      }

      // Create layout directory and widget layout if needed
      const layoutPath = path.join(resPath, 'layout');
      const widgetLayoutPath = path.join(layoutPath, 'widget_weather.xml');

      if (!fs.existsSync(layoutPath)) {
        fs.mkdirSync(layoutPath, { recursive: true });
      }

      if (!fs.existsSync(widgetLayoutPath)) {
        const widgetLayoutContent = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="16dp"
    android:background="#4CAF50"
    android:gravity="center">
    
    <TextView
        android:id="@+id/widget_text"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="VineSight Widget"
        android:textSize="18sp"
        android:textStyle="bold"
        android:textColor="#FFFFFF"
        android:gravity="center" />

</LinearLayout>`;
        fs.writeFileSync(widgetLayoutPath, widgetLayoutContent);
      }

      // Ensure strings.xml includes widget text resources
      const valuesPath = path.join(resPath, 'values');
      const stringsPath = path.join(valuesPath, 'strings.xml');
      if (!fs.existsSync(valuesPath)) {
        fs.mkdirSync(valuesPath, { recursive: true });
      }
      let stringsContent = fs.existsSync(stringsPath)
        ? fs.readFileSync(stringsPath, 'utf8')
        : '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n';

      if (!stringsContent.includes('</resources>')) {
        console.warn(
          `[android-widget] strings.xml at ${stringsPath} is malformed (missing </resources>). Rebuilding minimal resources file.`,
        );
        stringsContent = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n';
      }

      const widgetStrings = [
        '<string name="widget_temp_condition">%1$d° %2$s</string>',
        '<string name="widget_humidity">Humidity: %1$d%%</string>',
        '<string name="widget_no_weather_data">No weather data</string>',
      ];

      widgetStrings.forEach((entry) => {
        const nameMatch = entry.match(/name="([^"]+)"/);
        const key = nameMatch?.[1];
        if (!key) return;
        if (!stringsContent.includes(`name="${key}"`)) {
          stringsContent = stringsContent.replace('</resources>', `  ${entry}\n</resources>`);
        }
      });
      fs.writeFileSync(stringsPath, stringsContent);

      return config;
    },
  ]);
};

/**
 * Main plugin function
 */
const withAndroidWidget = (config) => {
  config = withWidgetResources(config);
  config = withKotlinSources(config);
  config = withMainApplicationKotlin(config);
  config = withWidgetReceiver(config);
  return config;
};

module.exports = withAndroidWidget;
