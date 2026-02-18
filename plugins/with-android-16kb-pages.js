/* eslint-disable @typescript-eslint/no-require-imports */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to enable 16 KB page size support for all native modules.
 *
 * Adds a subprojects block to the root build.gradle that injects
 * -DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON into every CMake-based
 * native build, ensuring all .so files are 16 KB aligned.
 *
 * Required by Google Play since Nov 2025 for apps targeting Android 15+.
 */
const withAndroid16kbPages = (config) => {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const buildGradlePath = path.join(config.modRequest.platformProjectRoot, 'build.gradle');
      let contents = fs.readFileSync(buildGradlePath, 'utf8');

      const marker = '// [16KB Page Size Support]';
      if (contents.includes(marker)) {
        return config;
      }

      const snippet = `
${marker}
// Ensure all native libraries are compiled with 16 KB page size alignment.
// Required for Google Play compliance on Android 15+ devices.
subprojects { sub ->
    sub.pluginManager.withPlugin("com.android.library") {
        sub.android {
            defaultConfig {
                externalNativeBuild {
                    cmake {
                        arguments "-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON"
                    }
                }
            }
        }
    }
    sub.pluginManager.withPlugin("com.android.application") {
        sub.android {
            defaultConfig {
                externalNativeBuild {
                    cmake {
                        arguments "-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON"
                    }
                }
            }
        }
    }
}
`;

      contents += snippet;
      fs.writeFileSync(buildGradlePath, contents);

      return config;
    },
  ]);
};

module.exports = withAndroid16kbPages;
