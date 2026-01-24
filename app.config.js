module.exports = {
  expo: {
    name: 'Vinesight',
    slug: 'vinesight-rn',
    version: '1.0.5',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'vinesight',
    newArchEnabled: true,
    statusBar: {
      backgroundColor: '#FFFFFF',
      barStyle: 'dark-content',
    },
    splash: {
      image: './assets/splash-screen.png',
      resizeMode: 'contain',
      backgroundColor: '#408059',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.vinesight.app',
      scheme: 'vinesight',
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
      versionCode: 6,
      adaptiveIcon: {
        foregroundImage: './assets/playstore.png',
        backgroundColor: '#408059',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: true,
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
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
        backgroundColor: '#FFFFFF',
        barStyle: 'dark-content',
      },
      navigationBar: {
        backgroundColor: '#FFFFFF',
        barStyle: 'dark',
      },
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      'expo-router',
      'expo-web-browser',
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
