module.exports = {
  expo: {
    name: 'Vinesight',
    slug: 'vinesight-rn',
    version: '2.5',
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
      buildNumber: '1.1.6',
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
      versionCode: 10,
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
      'expo-localization',
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
          microphonePermission: false,
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
