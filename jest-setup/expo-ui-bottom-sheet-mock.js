/* eslint-disable @typescript-eslint/no-require-imports, react/prop-types, react/display-name */
/**
 * Test mock for @expo/ui/community/bottom-sheet.
 *
 * The real BottomSheet renders its content into a native host view (SwiftUI /
 * Jetpack Compose). Under jest that native boundary is not press-traversable, so
 * `fireEvent.press` on a control inside the sheet never reaches its `onPress`.
 * This mock renders the sheet content as plain RN views — only while the sheet is
 * open (`index >= 0`), matching the real visibility contract — so unit tests can
 * exercise the logic behind sheet controls.
 *
 * Wire it into a test with:
 *   jest.mock('@expo/ui/community/bottom-sheet', () =>
 *     require('../jest-setup/expo-ui-bottom-sheet-mock'));
 */
const React = require('react');
const { View, ScrollView } = require('react-native');

const BottomSheet = ({ index, children }) =>
  index >= 0 ? React.createElement(View, null, children) : null;

const passthrough =
  (Host) =>
  ({ children, ...props }) =>
    React.createElement(Host, props, children);

const BottomSheetView = passthrough(View);
const BottomSheetScrollView = passthrough(ScrollView);
const BottomSheetFlatList = passthrough(ScrollView);

module.exports = {
  __esModule: true,
  BottomSheet,
  default: BottomSheet,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetFlatList,
  useBottomSheet: () => ({ close: () => {}, expand: () => {}, collapse: () => {} }),
};
