/* eslint-disable @typescript-eslint/no-require-imports */
const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE_IMPORT = 'import com.vinesight.AndroidSmsRetrieverPackage';
const PACKAGE_CALL = 'add(AndroidSmsRetrieverPackage())';
const GRADLE_DEPENDENCY =
  'implementation("com.google.android.gms:play-services-auth-api-phone:18.3.0")';
const GRADLE_MARKER = '// [Android SMS Retriever]';

function copyKotlinFilesRecursively(sourceDir, targetDir) {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }
      copyKotlinFilesRecursively(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.kt')) continue;
    fs.copyFileSync(sourcePath, targetPath);
  }
}

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
        console.warn(`[android-sms-retriever] MainApplication.kt not found at: ${applicationPath}`);
        return config;
      }

      let contents = fs.readFileSync(applicationPath, 'utf8');

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
          contents = contents.replace(
            packagesMatch[0],
            packagesMatch[0].replace(/(\n\s*\})$/, `\n              ${PACKAGE_CALL}$1`),
          );
        }
      }

      fs.writeFileSync(applicationPath, contents);
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

      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }

      copyKotlinFilesRecursively(pluginPath, targetPath);
      return config;
    },
  ]);
}

function withSmsRetrieverDependency(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    const dependencyRegex =
      /implementation\s*\(\s*["']com\.google\.android\.gms:play-services-auth-api-phone:[^"']+["']\s*\)/;
    const existingMatch = contents.match(dependencyRegex);

    if (existingMatch) {
      contents = contents.replace(existingMatch[0], GRADLE_DEPENDENCY);
    } else if (!contents.includes(GRADLE_DEPENDENCY)) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    ${GRADLE_MARKER}\n    ${GRADLE_DEPENDENCY}`,
      );
    }

    if (!contents.includes(GRADLE_MARKER)) {
      contents = contents.replace(/dependencies\s*\{/, `dependencies {\n    ${GRADLE_MARKER}`);
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withAndroidSmsRetriever(config) {
  config = withKotlinSources(config);
  config = withMainApplicationKotlin(config);
  config = withSmsRetrieverDependency(config);
  return config;
};
