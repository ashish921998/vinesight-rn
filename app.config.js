module.exports = {
  expo: {
    name: 'Vinesight',
    slug: 'vinesight-rn',
    version: '3.1.2',
    orientation: 'portrait',
    icon: './assets/icons/ios-light.png',
    userInterfaceStyle: 'automatic',
    scheme: 'vinesight',
    newArchEnabled: true,
    statusBar: {
      backgroundColor: 'transparent',
      barStyle: 'auto',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.vinesight.ios',
      scheme: 'vinesight',
      usesAppleSignIn: true,
      buildNumber: '1.2.4',
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
      versionCode: 18,
      permissions: ['android.permission.RECORD_AUDIO'],
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
      edgeToEdgeEnabled: true,
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
      navigationBar: {
        backgroundColor: 'transparent',
        barStyle: 'auto',
      },
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      'expo-router',
      'expo-notifications',
      '@sentry/react-native/expo',
      'expo-localization',
      '@bacons/apple-targets',
      './plugins/android-widget',
      './plugins/with-android-16kb-pages',
      [
        'expo-build-properties',
        {
          android: {
            ndkVersion: '27.1.12297006',
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            buildToolsVersion: '36.0.0',
            useLegacyPackaging: false,
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
        projectId: 'ede2bb37-3ad0-4503-9522-02bd1539e79b',
      },
    },
  },
};
