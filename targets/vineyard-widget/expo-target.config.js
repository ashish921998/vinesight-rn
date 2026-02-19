module.exports = () => ({
  type: 'widget',
  name: 'VineyardWidget',
  icon: '../../assets/icons/ios-light.png',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.vinesight.app'],
  },
  colors: {
    accent: '#4CAF50',
    background: '#FFFFFF',
    text: '#000000',
  },
});
