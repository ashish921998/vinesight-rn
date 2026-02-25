/* eslint-disable @typescript-eslint/no-require-imports */
const { withXcodeProject } = require('@expo/config-plugins');

const BUILD_SETTING_KEY = 'CODE_SIGN_ALLOW_ENTITLEMENTS_MODIFICATION';

module.exports = function withIosEntitlementsCodesign(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const section = project.pbxXCBuildConfigurationSection();

    Object.keys(section).forEach((key) => {
      const value = section[key];
      if (!value || typeof value !== 'object' || !value.buildSettings) return;
      value.buildSettings[BUILD_SETTING_KEY] = 'YES';
    });

    return config;
  });
};
