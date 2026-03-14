import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { useThemeTokens } from '@/styles/use-theme';
import { spacing } from '@/styles/theme';

export default function AssistantScreen() {
  const { m3 } = useThemeTokens();
  const { t } = useTranslation();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: m3.colorScheme.surface,
        paddingHorizontal: spacing[6],
      }}
    >
      <SymbolIcon name="sparkles" size={64} color={m3.colorScheme.primary} />
      <Text
        style={{
          ...m3.typography.headlineSmall,
          color: m3.colorScheme.onSurface,
          marginTop: spacing[4],
          textAlign: 'center',
        }}
      >
        {t('tabs.aiAssistant')}
      </Text>
      <Text
        style={{
          ...m3.typography.bodyMedium,
          color: m3.colorScheme.onSurfaceVariant,
          marginTop: spacing[2],
          textAlign: 'center',
        }}
      >
        {t('assistant.placeholder')}
      </Text>
    </View>
  );
}
