import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemeTokens } from '@/styles/use-theme';
import { borderRadius, spacing } from '@/styles/theme';
import { Symbol as Icon } from '@/components/ui/symbol';
import { ActionButton, Card, TransitionView } from '@/components/ui';
import { colorWithOpacity } from '@/utils/color';
import { tapLight, tapMedium } from '@/lib/haptics';

export default function AssistantTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { m3 } = useThemeTokens();

  const suggestions = [
    'When should I irrigate?',
    'Show my spray history',
    'What tasks are due today?',
    'Weather forecast for my farm',
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
      contentContainerStyle={{
        paddingHorizontal: spacing[4],
        paddingTop: insets.top + spacing[4],
        paddingBottom: Math.max(insets.bottom + spacing[6], spacing[8]),
      }}
    >
      <TransitionView>
        <Text style={{ ...m3.typography.headlineLarge, color: m3.colorScheme.onSurface }}>
          {t('tabs.assistant')}
        </Text>
        <Text
          style={{
            ...m3.typography.bodyLarge,
            marginTop: spacing[2],
            color: m3.colorScheme.onSurfaceVariant,
          }}
        >
          Ask in natural language. Get answers without navigating multiple screens.
        </Text>
      </TransitionView>

      <TransitionView style={{ marginTop: spacing[5] }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.14),
              }}
            >
              <Icon name="assistant" size={22} color={m3.colorScheme.primary} />
            </View>
            <Text
              style={{
                ...m3.typography.titleMedium,
                color: m3.colorScheme.onSurface,
                marginLeft: spacing[3],
              }}
            >
              Conversation-first farming assistant
            </Text>
          </View>
        </Card>
      </TransitionView>

      <TransitionView style={{ marginTop: spacing[5] }}>
        <Text
          style={{
            ...m3.typography.titleMedium,
            color: m3.colorScheme.onSurface,
            marginBottom: spacing[2],
          }}
        >
          Try asking
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => {
                tapLight();
                router.push('/ai-chat');
              }}
              style={({ pressed }) => ({
                borderRadius: borderRadius.full,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[2],
                backgroundColor: pressed
                  ? colorWithOpacity(m3.colorScheme.primary, 0.2)
                  : colorWithOpacity(m3.colorScheme.primary, 0.12),
              })}
            >
              <Text style={{ ...m3.typography.labelLarge, color: m3.colorScheme.primary }}>
                {suggestion}
              </Text>
            </Pressable>
          ))}
        </View>
      </TransitionView>

      <TransitionView style={{ marginTop: spacing[8] }}>
        <ActionButton
          title="Open full assistant"
          tone="primary"
          onPress={() => {
            tapMedium();
            router.push('/ai-chat');
          }}
        />
      </TransitionView>

      <TransitionView style={{ marginTop: spacing[4] }}>
        <ActionButton
          title="Voice input"
          tone="accent"
          onPress={() => {
            tapMedium();
            router.push('/ai-chat');
          }}
        />
      </TransitionView>
    </ScrollView>
  );
}
