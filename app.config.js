module.exports = {
  expo: {
    name: 'Vinesight',
    slug: 'vinesight-rn',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: 'vinesight',
    newArchEnabled: false,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#408059',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.vinesight.app',
      config: {
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Vinesight needs your location to show nearby farms and provide weather data.',
        NSLocationAlwaysUsageDescription:
          'Vinesight needs your location to provide weather updates for your farms.',
      },
    },
    android: {
      package: 'com.vinesight.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#408059',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: true,
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-font',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'Allow Vinesight to use your location.',
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
