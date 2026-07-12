describe('Android settings icon mappings', () => {
  const glyphMap =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json') as Record<
      string,
      number
    >;

  it.each(['office-building', 'view-dashboard-outline'])(
    '%s is available in MaterialCommunityIcons',
    (icon) => {
      expect(glyphMap[icon]).toBeDefined();
    },
  );
});
