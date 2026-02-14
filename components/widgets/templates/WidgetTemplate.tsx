import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type WidgetTemplateProps = Record<string, never>;

export const WidgetTemplate: React.FC<WidgetTemplateProps> = () => {
  return (
    <View style={styles.container}>
      <Text>Widget Template</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
});
