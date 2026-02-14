import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BaseWidgetProps } from '@widgets/shared/types';

export type TestWidgetProps = BaseWidgetProps;

export const TestWidget: React.FC<TestWidgetProps> = ({ testID, accessibilityLabel, style }) => {
  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} style={[styles.container, style]}>
      <Text>TestWidget</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
});
