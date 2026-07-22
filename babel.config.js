module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo auto-adds react-native-worklets/plugin (Reanimated 4)
    // and @expo/ui/babel-plugin when installed — do not add them manually or
    // the worklets transform runs twice and breaks worklet init.
    presets: ['babel-preset-expo'],
  };
};
