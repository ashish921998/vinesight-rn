/* eslint-disable @typescript-eslint/no-require-imports */
const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE_IMPORT = 'import com.vinesight.PhoneNumberHintPackage';
const PACKAGE_CALL = 'add(PhoneNumberHintPackage())';
const GRADLE_DEPENDENCY = 'implementation("com.google.android.gms:play-services-auth:21.5.1")';
const GRADLE_MARKER = '// [Phone Number Hint]';

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
        console.warn(
          `[android-phone-number-hint] MainApplication.kt not found at: ${applicationPath}`,
        );
        return config;
      }

      let contents;
      try {
        contents = fs.readFileSync(applicationPath, 'utf8');
      } catch (error) {
        console.warn(
          `[android-phone-number-hint] Failed to read MainApplication.kt at ${applicationPath}:`,
          error,
        );
        return config;
      }

      if (!contents.includes(PACKAGE_IMPORT)) {
        const lastImportIndex = contents.lastIndexOf('\nimport ');
        if (lastImportIndex !== -1) {
          const lastImportEnd = contents.indexOf('\n', lastImportIndex + 1);
          contents =
            contents.substring(0, lastImportEnd) +
            '\n' +
            PACKAGE_IMPORT +
            contents.substring(lastImportEnd);
        }
      }

      if (!contents.includes(PACKAGE_CALL)) {
        const packagesMatch = contents.match(
          /PackageList\(this\)\.packages\.apply \{[\s\S]*?\n\s*\}/m,
        );
        if (packagesMatch) {
          const applyBlock = packagesMatch[0];
          const newApplyBlock = applyBlock.replace(
            /(\n\s*\})$/,
            `\n              ${PACKAGE_CALL}$1`,
          );
          contents = contents.replace(applyBlock, newApplyBlock);
        }
      }

      if (!contents.includes(PACKAGE_IMPORT) || !contents.includes(PACKAGE_CALL)) {
        console.warn(
          '[android-phone-number-hint] Failed to inject PhoneNumberHintPackage into MainApplication.kt.',
        );
        return config;
      }

      try {
        fs.writeFileSync(applicationPath, contents);
      } catch (error) {
        console.warn(
          `[android-phone-number-hint] Failed to write MainApplication.kt at ${applicationPath}:`,
          error,
        );
      }

      return config;
    },
  ]);
}

function withKotlinSources(config) {
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

      if (!fs.existsSync(pluginPath)) {
        console.warn(
          `[android-phone-number-hint] Kotlin source directory not found: ${pluginPath}`,
        );
        return config;
      }

      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }

      for (const entry of fs.readdirSync(pluginPath, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.kt')) continue;

        const sourcePath = path.join(pluginPath, entry.name);
        const targetFilePath = path.join(targetPath, entry.name);

        try {
          fs.copyFileSync(sourcePath, targetFilePath);
        } catch (error) {
          console.warn(
            `[android-phone-number-hint] Failed to copy ${sourcePath} -> ${targetFilePath}:`,
            error,
          );
        }
      }

      return config;
    },
  ]);
}

function withPhoneNumberHintDependency(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes(GRADLE_DEPENDENCY)) {
      return config;
    }

    config.modResults.contents = config.modResults.contents.replace(
      /dependencies\s*\{/,
      `dependencies {\n    ${GRADLE_MARKER}\n    ${GRADLE_DEPENDENCY}`,
    );

    return config;
  });
}

const withAndroidPhoneNumberHint = (config) => {
  config = withKotlinSources(config);
  config = withMainApplicationKotlin(config);
  config = withPhoneNumberHintDependency(config);
  return config;
};

module.exports = withAndroidPhoneNumberHint;
