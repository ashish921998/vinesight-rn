/* eslint-disable @typescript-eslint/no-require-imports */
const { withGradleProperties } = require('@expo/config-plugins');

/**
 * Expo Config Plugin — raise the Gradle daemon JVM heap.
 *
 * WHY: R8 code shrinking (enabled via `enableMinifyInReleaseBuilds`) runs the
 * `:app:minifyReleaseWithR8` task inside the Gradle daemon JVM. The default
 * prebuild-generated `gradle.properties` caps it at `-Xmx2048m`, which is too
 * small for this app and fails the release build with
 * `java.lang.OutOfMemoryError: Java heap space`. Bumping the daemon to 4 GB
 * fixes it; GitHub-hosted runners have 14-16 GB RAM, so this is comfortable.
 *
 * WHY A PLUGIN: `.easignore` excludes `/android`, so EAS prebuilds the native
 * project fresh from `app.config.js` (CNG) on every build. Editing the
 * committed `gradle.properties` directly would be overwritten by prebuild —
 * the change must live here to survive prebuild.
 *
 * Raise this further (e.g. 6144m) only if R8 still OOMs.
 */
const GRADLE_JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=512m';
const KEY = 'org.gradle.jvmargs';

const withGradleJvmHeap = (config) => {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const existing = props.find((p) => p.type === 'property' && p.key === KEY);

    if (existing) {
      if (existing.value === GRADLE_JVM_ARGS) {
        return cfg;
      }
      existing.value = GRADLE_JVM_ARGS;
    } else {
      props.push({ type: 'property', key: KEY, value: GRADLE_JVM_ARGS });
    }

    return cfg;
  });
};

module.exports = withGradleJvmHeap;
