/* eslint-disable @typescript-eslint/no-require-imports */
const { withMainApplication, withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const { getMainApplicationOrThrow } = AndroidConfig.Manifest;

/**
 * Expo Config Plugin for Android Home Screen Widget Support
 *
 * This plugin:
 * 1. Registers WidgetPackage in MainApplication.java
 * 2. Adds WeatherWidgetProvider receiver to AndroidManifest.xml
 */

/**
 * Adds WidgetPackage import and registration to MainApplication.java
 */
const withWidgetPackage = (config) => {
  return withMainApplication(config, (config) => {
    const { modResults } = config;
    let { contents } = modResults;

    // Check if already modified
    if (contents.includes('com.vinesight.WidgetPackage')) {
      return config;
    }

    // Add import statement after the last import
    const importStatement = 'import com.vinesight.WidgetPackage;';
    const lastImportMatch = contents.match(/import .*;/g);
    if (lastImportMatch && lastImportMatch.length > 0) {
      const lastImport = lastImportMatch[lastImportMatch.length - 1];
      contents = contents.replace(lastImport, `${lastImport}\n${importStatement}`);
    }

    // Add package to getPackages() method
    // Look for the line that returns the packages list and add our package before the closing bracket
    const packageAddition = '      packages.add(new WidgetPackage());';

    // Find the pattern where packages are added and add our package
    // Look for "return packages;" or similar and add before it
    const returnPackagesMatch = contents.match(
      /(packages\.add\([^)]+\);\s*)+(?=\s*return packages;)/,
    );
    if (returnPackagesMatch) {
      const existingAdditions = returnPackagesMatch[0];
      contents = contents.replace(existingAdditions, `${existingAdditions}\n${packageAddition}`);
    } else {
      // Alternative: find "return packages;" and add before it
      contents = contents.replace(/return packages;/g, `${packageAddition}\n    return packages;`);
    }

    modResults.contents = contents;
    return config;
  });
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
 * Main plugin function
 */
const withAndroidWidget = (config) => {
  config = withWidgetPackage(config);
  config = withWidgetReceiver(config);
  return config;
};

module.exports = withAndroidWidget;
