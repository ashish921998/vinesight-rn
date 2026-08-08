const fs = require('fs');
const path = require('path');

// Android FCM config (google-services.json). EAS cloud builds inject it via the
// GOOGLE_SERVICES_JSON file env var (value = absolute path); local dev can drop a
// ./google-services.json. When neither exists — e.g. the Size Analysis workflow,
// which runs `eas build --local` on a runner without the secret — leave it
// undefined so prebuild doesn't crash copying a missing file (that size-only
// build needs no FCM).
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ||
  (fs.existsSync(path.join(__dirname, 'google-services.json'))
    ? path.join(__dirname, 'google-services.json')
    : undefined);

// Sentry auth: the AGP mapping/native-symbol upload tasks must be gated on a
// real token. A release build without SENTRY_AUTH_TOKEN would otherwise
// schedule the upload task with no credential and can fail the Gradle build —
// SENTRY_ALLOW_FAILURE is a sentry-cli env var that the AGP upload task does
// not reliably honor. Evaluated at prebuild time, so each build environment
// (EAS secret present vs. local/size build) gets the right behavior.
const hasSentryAuthToken = Boolean(process.env.SENTRY_AUTH_TOKEN?.trim());

// EAS Update runtime version policy. `fingerprint` hashes native config +
// code so any native change (new module, manifest edit, plugin config) auto-
// bumps the runtime version, preventing OTA pushes that can't run on the
// build's native layer. On a bump, a new store build is required; OTA updates
// only flow to builds that share the fingerprint. This is the safest policy
// for a bare/prebuilt project.
//
// Size-analysis CI builds use sdkVersion instead — the runner lacks file-type
// EAS secrets (GOOGLE_SERVICES_JSON, EXPO_APPLE_TEAM_ID) that change the
// fingerprint hash, causing a mismatch that fails the Configure expo-updates
// build phase during local builds.
const EAS_PROJECT_ID = 'ede2bb37-3ad0-4503-9522-02bd1539e79b';
const isSizeAnalysis = process.env.SIZE_ANALYSIS === 'true';

module.exports = {
  expo: {
    name: 'Vinesight',
    slug: 'vinesight-rn',
    version: '3.3.25',
    orientation: 'portrait',
    // EAS Update (OTA). Builds fetch updates from the project's EAS URL on
    // launch; `fallbackToCacheTimeout: 0` runs the cached update immediately
    // and applies the downloaded one on next launch (non-blocking). Runtime
    // version is derived from a native fingerprint so an update is only
    // delivered to a build whose native layer can actually run it.
    updates: {
      url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
      enabled: true,
      fallbackToCacheTimeout: 0,
      checkAutomatically: 'ON_LOAD',
    },
    runtimeVersion: isSizeAnalysis ? { policy: 'sdkVersion' } : { policy: 'fingerprint' },
    icon: './assets/icons/ios-light.png',
    userInterfaceStyle: 'automatic',
    scheme: 'vinesight',
    statusBar: {
      backgroundColor: 'transparent',
      barStyle: 'auto',
    },
    ios: {
      appleTeamId: process.env.EXPO_APPLE_TEAM_ID || undefined,
      supportsTablet: true,
      bundleIdentifier: 'com.vinesight.ios',
      usesAppleSignIn: true,
      buildNumber: '1.3.8',
      entitlements: {
        'com.apple.security.application-groups': ['group.com.vinesight.app'],
      },
      icon: {
        light: './assets/icons/ios-light.png',
        dark: './assets/icons/ios-dark.png',
        tinted: './assets/icons/ios-tinted.png',
      },
      config: {
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Vinesight uses your location to show nearby farms and local weather.',
        NSMicrophoneUsageDescription: 'Allow Vinesight to use the microphone for voice queries.',
        NSSpeechRecognitionUsageDescription:
          'Allow Vinesight to convert your speech to text for voice queries.',
      },
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyCollectedDataTypes: [],
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
            NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
            NSPrivacyAccessedAPITypeReasons: ['0A2A.1', '3B52.1', 'C617.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
            NSPrivacyAccessedAPITypeReasons: ['85F4.1', 'E174.1'],
          },
        ],
      },
    },
    android: {
      package: 'com.vinesight.app',
      versionCode: 43,
      // Required for FCM so `FirebaseApp.initializeApp` runs at build time;
      // without it `getExpoPushTokenAsync` fails on Android with
      // E_REGISTRATION_FAILED ("Default FirebaseApp is not initialized").
      // Resolved above from GOOGLE_SERVICES_JSON (EAS) or a local file; left
      // undefined when absent so CI size builds don't fail prebuild.
      googleServicesFile,
      permissions: ['android.permission.RECORD_AUDIO', 'android.permission.POST_NOTIFICATIONS'],
      config: {
        googleMaps: {
          apiKey:
            process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
        },
      },
      softwareKeyboardLayoutMode: 'resize',
      adaptiveIcon: {
        foregroundImage: './assets/icons/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      predictiveBackGestureEnabled: true,
      intentFilters: [
        {
          action: 'VIEW',
          category: ['BROWSABLE', 'DEFAULT'],
          data: {
            scheme: 'vinesight',
            host: '*',
          },
        },
      ],
      statusBar: {
        backgroundColor: 'transparent',
        barStyle: 'auto',
      },
      // Navigation-bar background and cold-start button contrast are owned by
      // ./plugins/with-android-navigation-bar; app/_layout.tsx drives runtime contrast.
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      // RNRepo: substitutes supported native libraries with pre-built,
      // GPG-signed artifacts from the public Maven repo instead of compiling
      // from source. Unsupported libraries / RN versions automatically fall
      // back to source compilation. Verify via "[📦 RNRepo]" build logs.
      '@rnrepo/expo-config-plugin',
      'expo-router',
      'expo-asset',
      'expo-system-ui',
      ['expo-navigation-bar', { enforceContrast: false }],
      './plugins/with-android-navigation-bar',
      [
        'expo-audio',
        {
          // The plugin defaults enableBackgroundPlayback to true, which adds
          // UIBackgroundModes: ['audio'] to Info.plist. The app does not play
          // persistent background audio, so leaving it on triggers App Store
          // Guideline 2.5.4 rejections.
          enableBackgroundPlayback: false,
        },
      ],
      'expo-notifications',
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          project: process.env.SENTRY_PROJECT || 'vinesight-rn',
          organization: process.env.SENTRY_ORG || 'vinesight-6s',
          // Now that release builds run R8 (enableMinifyInReleaseBuilds),
          // Java/Kotlin stack frames are obfuscated. The Sentry Android
          // Gradle plugin uploads the R8/ProGuard mapping so Sentry can
          // deobfuscate native crashes. Every auto-upload task is gated on
          // SENTRY_AUTH_TOKEN: when present the generated gradle block calls
          // shouldSentryAutoUpload() (normal upload); when absent it emits
          // `= false`, so the task is never scheduled and can't fail builds
          // that lack the token (local dev, size-analysis runs).
          experimental_android: {
            enableAndroidGradlePlugin: true,
            autoUploadProguardMapping: hasSentryAuthToken,
            uploadNativeSymbols: hasSentryAuthToken,
            autoUploadNativeSymbols: hasSentryAuthToken,
          },
        },
      ],
      'expo-localization',
      '@bacons/apple-targets',
      './plugins/android-widget',
      './plugins/android-phone-number-hint',
      './plugins/android-sms-retriever',
      './plugins/with-android-16kb-pages',
      './plugins/with-gradle-jvm-heap',
      './plugins/with-ios-entitlements-codesign',
      [
        'expo-build-properties',
        {
          android: {
            ndkVersion: '27.1.12297006',
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            buildToolsVersion: '36.0.0',
            useLegacyPackaging: false,
            // Enable R8 code shrinking in release builds (Play Console
            // "optimize your app" recommendation). Minify only — resource
            // shrinking is left off to avoid stripping dynamically-loaded
            // assets. R8/ProGuard consumer rules are provided by the RN core
            // and library AARs themselves; no extra keep rules are added here.
            // If a release smoke test surfaces a stripped-class crash, add the
            // minimal keep rule for that specific class here.
            enableMinifyInReleaseBuilds: true,
          },
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#ffffff',
          image: './assets/icons/splash-icon-dark.png',
          resizeMode: 'contain',
          imageWidth: 200,
          dark: {
            backgroundColor: '#000000',
            image: './assets/icons/splash-icon-light.png',
          },
        },
      ],
      'expo-web-browser',
      'expo-secure-store',
      'expo-font',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: false,
          locationAlwaysPermission: false,
          locationWhenInUsePermission: 'Allow Vinesight to use your location.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Allow Vinesight to access your photos to attach lab reports and images.',
          cameraPermission: 'Allow Vinesight to use your camera to capture lab reports and photos.',
          microphonePermission:
            'Allow Vinesight to use the microphone when capturing video or using voice features.',
        },
      ],
      [
        'expo-speech-recognition',
        {
          microphonePermission: 'Allow Vinesight to use the microphone for voice queries.',
          speechRecognitionPermission:
            'Allow Vinesight to use speech recognition for voice queries.',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      eas: {
        projectId: EAS_PROJECT_ID,
      },
    },
  },
};
