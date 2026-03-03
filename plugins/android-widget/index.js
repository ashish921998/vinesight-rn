/* eslint-disable @typescript-eslint/no-require-imports */
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  AndroidConfig,
} = require('@expo/config-plugins');
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

      const copyKotlinFilesRecursively = (srcDir, destDir) => {
        for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
          const srcPath = path.join(srcDir, entry.name);
          const destPath = path.join(destDir, entry.name);

          if (entry.isDirectory()) {
            if (!fs.existsSync(destPath)) {
              fs.mkdirSync(destPath, { recursive: true });
            }
            copyKotlinFilesRecursively(srcPath, destPath);
            continue;
          }

          if (!entry.isFile() || !entry.name.endsWith('.kt')) continue;
          const skipOverwrite =
            process.env.EXPO_ANDROID_WIDGET_SKIP_KOTLIN_OVERWRITE === '1' &&
            fs.existsSync(destPath);
          if (skipOverwrite) {
            continue;
          }
          try {
            // Intentionally overwrite Kotlin sources so native bridge/provider code stays current.
            // Set EXPO_ANDROID_WIDGET_SKIP_KOTLIN_OVERWRITE=1 to preserve local Android edits during development.
            // This differs from withWidgetResources, where XML files are preserved for user customization.
            fs.copyFileSync(srcPath, destPath);
          } catch (error) {
            console.warn(`[android-widget] Failed to copy ${srcPath} -> ${destPath}:`, error);
          }
        }
      };

      copyKotlinFilesRecursively(pluginPath, targetPath);

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
    android:minWidth="180dp"
    android:minHeight="110dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_weather"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen">
</appwidget-provider>`;
        try {
          fs.writeFileSync(widgetInfoPath, widgetInfoContent);
        } catch (error) {
          console.warn(`[android-widget] Failed to write ${widgetInfoPath}:`, error);
        }
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
    android:background="@color/widget_background"
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
        try {
          fs.writeFileSync(widgetLayoutPath, widgetLayoutContent);
        } catch (error) {
          console.warn(`[android-widget] Failed to write ${widgetLayoutPath}:`, error);
        }
      }

      // Ensure strings.xml includes widget text resources
      const valuesPath = path.join(resPath, 'values');
      const stringsPath = path.join(valuesPath, 'strings.xml');
      const defaultResourcesXml =
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n';
      if (!fs.existsSync(valuesPath)) {
        fs.mkdirSync(valuesPath, { recursive: true });
      }
      let stringsContent = defaultResourcesXml;
      if (fs.existsSync(stringsPath)) {
        try {
          stringsContent = fs.readFileSync(stringsPath, 'utf8');
        } catch (error) {
          console.warn(`[android-widget] Failed to read ${stringsPath}:`, error);
        }
      }

      if (!stringsContent.includes('</resources>')) {
        console.warn(
          `[android-widget] strings.xml at ${stringsPath} is malformed (missing </resources>). Rebuilding minimal resources file.`,
        );
        stringsContent = defaultResourcesXml;
      }

      const upsertWidgetStrings = (content, stringEntries) => {
        let updatedContent = content;
        stringEntries.forEach(({ key, value }) => {
          if (!updatedContent.includes(`name="${key}"`)) {
            updatedContent = updatedContent.replace(
              '</resources>',
              `  <string name="${key}">${value}</string>\n</resources>`,
            );
          }
        });
        return updatedContent;
      };

      const widgetStrings = [
        { key: 'widget_temp_condition', value: '%1$d° %2$s' },
        { key: 'widget_humidity', value: 'Humidity: %1$d%%' },
        { key: 'widget_loading', value: 'Loading weather...' },
        { key: 'widget_error', value: 'Unable to load weather' },
        { key: 'widget_no_weather_data', value: 'No weather data' },
      ];
      stringsContent = upsertWidgetStrings(stringsContent, widgetStrings);
      try {
        fs.writeFileSync(stringsPath, stringsContent);
      } catch (error) {
        console.warn(`[android-widget] Failed to write ${stringsPath}:`, error);
      }

      const localizedWidgetStrings = {
        'values-hi': [
          { key: 'widget_temp_condition', value: '%1$d° %2$s' },
          { key: 'widget_humidity', value: 'नमी: %1$d%%' },
          { key: 'widget_loading', value: 'मौसम लोड हो रहा है...' },
          { key: 'widget_error', value: 'मौसम लोड नहीं हो सका' },
          { key: 'widget_no_weather_data', value: 'कोई मौसम डेटा नहीं' },
        ],
        'values-mr': [
          { key: 'widget_temp_condition', value: '%1$d° %2$s' },
          { key: 'widget_humidity', value: 'आर्द्रता: %1$d%%' },
          { key: 'widget_loading', value: 'हवामान लोड होत आहे...' },
          { key: 'widget_error', value: 'हवामान लोड करता आले नाही' },
          { key: 'widget_no_weather_data', value: 'हवामान डेटा उपलब्ध नाही' },
        ],
      };

      Object.entries(localizedWidgetStrings).forEach(([valuesDirName, stringEntries]) => {
        const localizedValuesPath = path.join(resPath, valuesDirName);
        const localizedStringsPath = path.join(localizedValuesPath, 'strings.xml');
        if (!fs.existsSync(localizedValuesPath)) {
          fs.mkdirSync(localizedValuesPath, { recursive: true });
        }

        let localizedStringsContent = defaultResourcesXml;
        if (fs.existsSync(localizedStringsPath)) {
          try {
            localizedStringsContent = fs.readFileSync(localizedStringsPath, 'utf8');
          } catch (error) {
            console.warn(`[android-widget] Failed to read ${localizedStringsPath}:`, error);
          }
        }

        if (!localizedStringsContent.includes('</resources>')) {
          console.warn(
            `[android-widget] strings.xml at ${localizedStringsPath} is malformed (missing </resources>). Rebuilding minimal resources file.`,
          );
          localizedStringsContent = defaultResourcesXml;
        }

        localizedStringsContent = upsertWidgetStrings(localizedStringsContent, stringEntries);

        try {
          fs.writeFileSync(localizedStringsPath, localizedStringsContent);
        } catch (error) {
          console.warn(`[android-widget] Failed to write ${localizedStringsPath}:`, error);
        }
      });

      // Ensure colors.xml includes widget background color resource
      const colorsPath = path.join(valuesPath, 'colors.xml');
      // Keep existing XML if present to preserve user edits (unlike Kotlin copyFileSync overwrite above).
      let colorsContent = defaultResourcesXml;
      if (fs.existsSync(colorsPath)) {
        try {
          colorsContent = fs.readFileSync(colorsPath, 'utf8');
        } catch (error) {
          console.warn(`[android-widget] Failed to read ${colorsPath}:`, error);
        }
      }

      if (!colorsContent.includes('</resources>')) {
        console.warn(
          `[android-widget] colors.xml at ${colorsPath} is malformed (missing </resources>). Rebuilding minimal resources file.`,
        );
        colorsContent = defaultResourcesXml;
      }

      if (!colorsContent.includes('name="widget_background"')) {
        colorsContent = colorsContent.replace(
          '</resources>',
          '  <color name="widget_background">#4CAF50</color>\n</resources>',
        );
      }

      try {
        fs.writeFileSync(colorsPath, colorsContent);
      } catch (error) {
        console.warn(`[android-widget] Failed to write ${colorsPath}:`, error);
      }

      return config;
    },
  ]);
};

/**
 * Adds Compose/Glance dependencies and Compose compiler config for the app module.
 */
const withComposeBuildConfig = (config) => {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    const ensureDependency = (dependencyLine) => {
      if (contents.includes(dependencyLine)) return;
      if (/dependencies\s*\{/.test(contents)) {
        contents = contents.replace(
          /dependencies\s*\{/,
          (match) => `${match}\n    ${dependencyLine}`,
        );
      }
    };

    ensureDependency('implementation("androidx.glance:glance-appwidget:1.1.1")');
    ensureDependency('implementation("androidx.glance:glance-material3:1.1.1")');

    if (!/compose\s+true/.test(contents)) {
      if (/buildFeatures\s*\{/.test(contents)) {
        contents = contents.replace(
          /buildFeatures\s*\{/,
          (match) => `${match}\n        compose true`,
        );
      } else if (/android\s*\{/.test(contents)) {
        contents = contents.replace(
          /android\s*\{/,
          (match) => `${match}\n    buildFeatures {\n        compose true\n    }`,
        );
      }
    }

    if (!/kotlinCompilerExtensionVersion/.test(contents) && /android\s*\{/.test(contents)) {
      contents = contents.replace(
        /android\s*\{/,
        (match) =>
          `${match}\n    composeOptions {\n        kotlinCompilerExtensionVersion = "1.5.15"\n    }`,
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};
/**
 * Main plugin function
 */
const withAndroidWidget = (config) => {
  config = withWidgetResources(config);
  config = withKotlinSources(config);
  config = withComposeBuildConfig(config);
  config = withMainApplicationKotlin(config);
  config = withWidgetReceiver(config);
  return config;
};

module.exports = withAndroidWidget;
