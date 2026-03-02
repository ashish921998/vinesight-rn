import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useProfile } from '@/hooks';
import { useThemeTokens } from '@/styles/use-theme';
import { borderRadius, spacing } from '@/styles/theme';
import { Card, ListRow, TransitionView } from '@/components/ui';
import { colorWithOpacity } from '@/utils/color';

export default function ProfileTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { m3 } = useThemeTokens();
  const { data: profile } = useProfile();

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
          {t('tabs.profile')}
        </Text>
      </TransitionView>

      <TransitionView style={{ marginTop: spacing[4] }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.14),
              }}
            >
              <Text style={{ ...m3.typography.titleMedium, color: m3.colorScheme.primary }}>
                {(profile?.full_name ?? 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ marginLeft: spacing[3], flex: 1 }}>
              <Text style={{ ...m3.typography.titleMedium, color: m3.colorScheme.onSurface }}>
                {profile?.full_name ?? 'User'}
              </Text>
              <Text style={{ ...m3.typography.bodyMedium, color: m3.colorScheme.onSurfaceVariant }}>
                VineSight farmer profile
              </Text>
            </View>
          </View>
        </Card>
      </TransitionView>

      <TransitionView style={{ marginTop: spacing[5] }}>
        <Text
          style={{
            ...m3.typography.labelSmall,
            color: m3.colorScheme.onSurfaceVariant,
            marginBottom: spacing[2],
          }}
        >
          MY FARM
        </Text>
        <Card padded={false}>
          <ListRow
            title={t('tabs.farms')}
            leftIcon="leaf.fill"
            onPress={() => router.push('/(tabs)/explore')}
          />
          <ListRow
            title={t('tabs.workers')}
            leftIcon="person.2.fill"
            onPress={() => router.push('/(tabs)/workers')}
          />
          <ListRow
            title={t('warehouse.title')}
            leftIcon="cube.fill"
            onPress={() => router.push('/warehouse')}
          />
        </Card>
      </TransitionView>

      <TransitionView style={{ marginTop: spacing[5] }}>
        <Text
          style={{
            ...m3.typography.labelSmall,
            color: m3.colorScheme.onSurfaceVariant,
            marginBottom: spacing[2],
          }}
        >
          TOOLS
        </Text>
        <Card padded={false}>
          <ListRow
            title={t('tabs.tools')}
            leftIcon="wrench.and.screwdriver.fill"
            onPress={() => router.push('/(tabs)/tools')}
          />
          <ListRow
            title={t('tasks.title')}
            leftIcon="checklist"
            onPress={() => router.push('/tasks')}
          />
          <ListRow
            title={t('tools.items.weatherIrrigation')}
            leftIcon="sun.max.fill"
            onPress={() => router.push('/weather')}
          />
          <ListRow
            title={t('reports.title')}
            leftIcon="doc.text.fill"
            onPress={() => router.push('/reports')}
          />
        </Card>
      </TransitionView>

      <TransitionView style={{ marginTop: spacing[5] }}>
        <Text
          style={{
            ...m3.typography.labelSmall,
            color: m3.colorScheme.onSurfaceVariant,
            marginBottom: spacing[2],
          }}
        >
          SETTINGS
        </Text>
        <Card padded={false}>
          <ListRow
            title={t('tabs.settings')}
            leftIcon="gearshape.fill"
            onPress={() => router.push('/(tabs)/settings')}
          />
          <ListRow
            title={t('onboarding.language.title')}
            leftIcon="globe"
            onPress={() => router.push('/(tabs)/settings')}
          />
          <ListRow
            title="About VineSight"
            leftIcon="info.circle.fill"
            onPress={() => router.push('/(tabs)/settings')}
          />
        </Card>
      </TransitionView>
    </ScrollView>
  );
}
