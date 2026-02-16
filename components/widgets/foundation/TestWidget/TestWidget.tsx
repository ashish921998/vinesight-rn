import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BaseWidgetProps } from '@widgets/shared/types';
import { useTranslation } from 'react-i18next';

export const TestWidget: React.FC<BaseWidgetProps> = ({ testID, accessibilityLabel, style }) => {
  const { t } = useTranslation();
  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} style={[styles.container, style]}>
      <Text>{t('widgets.template.testWidget.label', 'Test Widget')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
});
