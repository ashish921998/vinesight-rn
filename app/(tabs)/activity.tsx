import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRecentActivities } from '@/hooks/use-dashboard-stats';
import { useThemeTokens } from '@/styles/use-theme';
import { borderRadius, spacing } from '@/styles/theme';
import { Symbol as Icon } from '@/components/ui/symbol';
import { Card, TransitionView } from '@/components/ui';
import { colorWithOpacity } from '@/utils/color';
import { tapLight } from '@/lib/haptics';

const ACTIVITY_TYPES = [
  { id: 'irrigation', icon: 'drop.fill', colorKey: 'irrigation' },
  { id: 'spray', icon: 'spraycan.fill', colorKey: 'spray' },
  { id: 'fertigation', icon: 'flask.fill', colorKey: 'fertigation' },
  { id: 'harvest', icon: 'leaf.fill', colorKey: 'harvest' },
  { id: 'observation', icon: 'doc.text.fill', colorKey: 'observation' },
  { id: 'note', icon: 'document', colorKey: 'primary' },
] as const;

export default function ActivityTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { m3, colors } = useThemeTokens();
  const { data: recentActivities } = useRecentActivities(8);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
      contentContainerStyle={{
        paddingHorizontal: spacing[4],
        paddingTop: insets.top + spacing[4],
        paddingBottom: Math.max(insets.bottom + spacing[8], spacing[10]),
      }}
    >
      <TransitionView>
        <Text style={{ ...m3.typography.headlineLarge, color: m3.colorScheme.onSurface }}>
          {t('tabs.activity')}
        </Text>
        <Text
          style={{
            ...m3.typography.bodyLarge,
            marginTop: spacing[1],
            color: m3.colorScheme.onSurfaceVariant,
          }}
        >
          Log any farm action in seconds.
        </Text>
      </TransitionView>

      <TransitionView style={{ marginTop: spacing[5] }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
          {ACTIVITY_TYPES.map((item) => {
            const colorToken =
              item.colorKey === 'primary' ? colors.primary[500] : colors[item.colorKey][500];
            const title =
              item.id === 'note'
                ? t('dashboard.quickActions.note')
                : t(`dashboard.quickActions.${item.id}` as never);

            return (
              <Card
                key={item.id}
                interactive
                padded={false}
                onPress={() => {
                  tapLight();
                  if (item.id === 'note') {
                    router.push('/add-note');
                  } else {
                    router.push({
                      pathname: '/add-entry',
                      params: { initialTab: 'log', tabs: 'log', initialLogType: item.id },
                    });
                  }
                }}
                style={{ width: '47%' }}
              >
                <View
                  style={{
                    paddingVertical: spacing[4],
                    paddingHorizontal: spacing[4],
                    backgroundColor: colorWithOpacity(colorToken, 0.1),
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: borderRadius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colorWithOpacity(colorToken, 0.18),
                        marginRight: spacing[3],
                      }}
                    >
                      <Icon name={item.icon} size={18} color={colorToken} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ ...m3.typography.labelLarge, color: m3.colorScheme.onSurface }}
                      >
                        {title}
                      </Text>
                      <Text
                        style={{
                          ...m3.typography.labelSmall,
                          color: m3.colorScheme.onSurfaceVariant,
                        }}
                      >
                        {t('entryForm.addLog')}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      </TransitionView>

      <TransitionView style={{ marginTop: spacing[6] }}>
        <Text
          style={{
            ...m3.typography.titleMedium,
            color: m3.colorScheme.onSurface,
            marginBottom: spacing[2],
          }}
        >
          {t('dashboard.recentActivity.title')}
        </Text>
        <Card padded={false}>
          {(recentActivities ?? []).slice(0, 6).map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/farm/${item.farmId}`)}
              style={{
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                borderBottomWidth: index === (recentActivities?.length ?? 1) - 1 ? 0 : 1,
                borderBottomColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
              }}
            >
              <Text style={{ ...m3.typography.labelLarge, color: m3.colorScheme.onSurface }}>
                {item.farmName}
              </Text>
              <Text style={{ ...m3.typography.labelSmall, color: m3.colorScheme.onSurfaceVariant }}>
                {item.description}
              </Text>
            </Pressable>
          ))}
          {!recentActivities || recentActivities.length === 0 ? (
            <View style={{ padding: spacing[4] }}>
              <Text style={{ ...m3.typography.bodyMedium, color: m3.colorScheme.onSurfaceVariant }}>
                {t('dashboard.empty.recentActivity')}
              </Text>
            </View>
          ) : null}
        </Card>
      </TransitionView>
    </ScrollView>
  );
}
