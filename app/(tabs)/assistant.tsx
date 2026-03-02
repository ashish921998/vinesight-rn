import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
            marginTop: spacing[1],
            color: m3.colorScheme.onSurfaceVariant,
          }}
        >
          Ask anything about your farms — logs, weather, tasks, and more.
        </Text>
      </TransitionView>

      <TransitionView style={{ marginTop: spacing[5] }}>
        <Card padded={false} interactive onPress={() => router.push('/ai-chat')}>
          <LinearGradient
            colors={[
              colorWithOpacity(m3.colorScheme.primary, 0.22),
              colorWithOpacity(m3.colorScheme.secondary, 0.12),
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: spacing[4] }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colorWithOpacity(m3.colorScheme.onSurface, 0.04),
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.1),
                }}
              >
                <Icon name="assistant" size={22} color={m3.colorScheme.primary} />
              </View>
              <View style={{ marginLeft: spacing[3], flex: 1 }}>
                <Text style={{ ...m3.typography.titleMedium, color: m3.colorScheme.onSurface }}>
                  Start a conversation
                </Text>
                <Text
                  style={{ ...m3.typography.bodyMedium, color: m3.colorScheme.onSurfaceVariant }}
                >
                  Tap to open the full assistant
                </Text>
              </View>
              <Icon name="chevron.right" size={16} color={m3.colorScheme.onSurfaceVariant} />
            </View>
          </LinearGradient>
        </Card>
      </TransitionView>

      <TransitionView style={{ marginTop: spacing[5] }}>
        <Text style={{ ...m3.typography.titleMedium, color: m3.colorScheme.onSurface }}>
          Try asking
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2], paddingTop: spacing[3] }}
        >
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
                  ? colorWithOpacity(m3.colorScheme.onSurface, 0.07)
                  : colorWithOpacity(m3.colorScheme.onSurface, 0.05),
                borderWidth: 1,
                borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.1),
              })}
            >
              <Text style={{ ...m3.typography.labelLarge, color: m3.colorScheme.onSurface }}>
                {suggestion}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </TransitionView>

      <TransitionView style={{ marginTop: spacing[8] }}>
        <ActionButton
          title="Open assistant"
          tone="primary"
          onPress={() => {
            tapMedium();
            router.push('/ai-chat');
          }}
        />
      </TransitionView>

      <TransitionView style={{ marginTop: spacing[4] }}>
        <ActionButton
          title="Voice"
          tone="secondary"
          onPress={() => {
            tapMedium();
            router.push('/ai-chat');
          }}
        />
      </TransitionView>
    </ScrollView>
  );
}
