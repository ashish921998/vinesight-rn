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

// Tokens we require to be present (and authoritative) on the Gradle daemon JVM.
const REQUIRED_TOKENS = GRADLE_JVM_ARGS.split(/\s+/).filter(Boolean);

// "Identity" of a JVM arg = the option name, used to detect conflicting values.
// `-Xmx4096m` -> `-Xmx`; `-XX:MaxMetaspaceSize=512m` -> `-XX:MaxMetaspaceSize`.
const identityOf = (token) => {
  if (token.startsWith('-Xmx')) return '-Xmx';
  const eq = token.indexOf('=');
  return eq === -1 ? token : token.slice(0, eq);
};

// Merge required heap/metaspace values into an existing org.gradle.jvmargs
// string, overriding only conflicting options while preserving the rest.
const mergeJvmArgs = (existingValue) => {
  const override = new Set(REQUIRED_TOKENS.map(identityOf));
  const preserved = existingValue
    .trim()
    .split(/\s+/)
    .filter((token) => token && !override.has(identityOf(token)));
  return [...REQUIRED_TOKENS, ...preserved].join(' ');
};

const withGradleJvmHeap = (config) => {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const existing = props.find((p) => p.type === 'property' && p.key === KEY);

    if (existing) {
      const merged = mergeJvmArgs(existing.value);
      if (merged === existing.value) {
        return cfg;
      }
      existing.value = merged;
    } else {
      props.push({ type: 'property', key: KEY, value: GRADLE_JVM_ARGS });
    }

    return cfg;
  });
};

module.exports = withGradleJvmHeap;
