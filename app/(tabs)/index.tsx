import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useDashboardStats, useFarms, useProfile, useRecentActivities, useWeather } from '@/hooks';
import { formatDate, formatNumber } from '@/i18n/format';
import { useThemeTokens } from '@/styles/use-theme';
import { borderRadius, spacing } from '@/styles/theme';
import { Symbol as Icon } from '@/components/ui/symbol';
import { Card, TransitionView } from '@/components/ui';
import { colorWithOpacity } from '@/utils/color';
import { tapLight } from '@/lib/haptics';

type GreetingKey = 'morning' | 'afternoon' | 'evening' | 'night';

const getGreetingKey = (): GreetingKey => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { m3 } = useThemeTokens();
  const [refreshing, setRefreshing] = useState(false);

  const greetingKey = getGreetingKey();
  const { data: profile } = useProfile();
  const { data: farms, refetch: refetchFarms, isLoading: farmsLoading } = useFarms();
  const { data: stats, refetch: refetchStats } = useDashboardStats();
  const {
    data: activities,
    refetch: refetchActivities,
    isLoading: activitiesLoading,
  } = useRecentActivities(6);

  const leadFarm = farms && farms.length > 0 ? farms[0] : null;
  const weather = useWeather(leadFarm?.latitude ?? undefined, leadFarm?.longitude ?? undefined);
  const todayLabel = formatDate(new Date(), { weekday: 'short', month: 'short', day: 'numeric' });

  const weatherSummary = useMemo(() => {
    if (!weather.data?.current) return t('common.loading');
    const current = weather.data.current;
    return `${Math.round(current.temperature)}°C · ${current.condition}`;
  }, [weather.data, t]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchActivities(), refetchFarms(), weather.refetch()]);
    setRefreshing(false);
  };

  const quickActions = [
    {
      key: 'log',
      icon: 'plus.circle.fill',
      label: t('entryForm.addLog'),
      onPress: () => router.push('/add-entry'),
    },
    {
      key: 'tasks',
      icon: 'checklist',
      label: t('tasks.title'),
      onPress: () => router.push('/tasks'),
    },
    {
      key: 'weather',
      icon: 'sun.max.fill',
      label: t('tools.items.weatherIrrigation'),
      onPress: () => router.push('/weather'),
    },
    {
      key: 'chat',
      icon: 'assistant',
      label: t('tabs.assistant'),
      onPress: () => router.push('/(tabs)/assistant'),
    },
  ] as const;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + spacing[10], spacing[12]) }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={m3.colorScheme.primary}
        />
      }
    >
      <View style={{ paddingHorizontal: spacing[4], paddingTop: insets.top + spacing[4] }}>
        <TransitionView>
          <Text style={{ ...m3.typography.headlineLarge, color: m3.colorScheme.onSurface }}>
            {profile?.full_name
              ? t(`dashboard.greetingWithName.${greetingKey}`, { name: profile.full_name })
              : t(`dashboard.greeting.${greetingKey}`)}
          </Text>
          <Text
            style={{
              ...m3.typography.bodyMedium,
              marginTop: spacing[1],
              color: m3.colorScheme.onSurfaceVariant,
            }}
          >
            {todayLabel}
          </Text>
        </TransitionView>

        <TransitionView style={{ marginTop: spacing[5] }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="sun.max.fill" size={18} color={m3.colorScheme.secondary} />
              <Text
                style={{
                  ...m3.typography.labelLarge,
                  marginLeft: spacing[2],
                  color: m3.colorScheme.onSurface,
                }}
              >
                {weatherSummary}
              </Text>
            </View>
          </Card>
        </TransitionView>

        <TransitionView style={{ marginTop: spacing[5] }}>
          <Text
            style={{
              ...m3.typography.titleMedium,
              color: m3.colorScheme.onSurface,
              marginBottom: spacing[3],
            }}
          >
            {t('dashboard.stats.farms')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: spacing[3] }}>
              {(farms ?? []).slice(0, 8).map((farm) => (
                <Pressable
                  key={farm.id}
                  onPress={() => {
                    tapLight();
                    if (farm.id) router.push(`/farm/${farm.id}`);
                  }}
                  style={({ pressed }) => ({
                    width: 220,
                    borderRadius: borderRadius['3xl'],
                    padding: spacing[4],
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <Text style={{ ...m3.typography.titleMedium, color: m3.colorScheme.onSurface }}>
                    {farm.name}
                  </Text>
                  <Text
                    style={{
                      ...m3.typography.bodyMedium,
                      color: m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {farm.region || t('common.na')}
                  </Text>
                  <Text
                    style={{
                      ...m3.typography.labelLarge,
                      marginTop: spacing[2],
                      color: m3.colorScheme.primary,
                    }}
                  >
                    {formatNumber(farm.area ?? 0, { maximumFractionDigits: 1 })} ac
                  </Text>
                </Pressable>
              ))}
              {farms && farms.length === 0 ? (
                <Card interactive onPress={() => router.push('/farm/add')} style={{ width: 220 }}>
                  <Text style={{ ...m3.typography.titleMedium, color: m3.colorScheme.onSurface }}>
                    {t('farms.empty.title')}
                  </Text>
                  <Text
                    style={{
                      ...m3.typography.bodyMedium,
                      color: m3.colorScheme.onSurfaceVariant,
                      marginTop: spacing[1],
                    }}
                  >
                    {t('dashboard.cta.addFirstFarm')}
                  </Text>
                </Card>
              ) : null}
            </View>
          </ScrollView>
        </TransitionView>

        <TransitionView style={{ marginTop: spacing[6] }}>
          <Text
            style={{
              ...m3.typography.titleMedium,
              color: m3.colorScheme.onSurface,
              marginBottom: spacing[3],
            }}
          >
            {t('dashboard.quickActions.title')}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {quickActions.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => {
                  tapLight();
                  action.onPress();
                }}
                style={({ pressed }) => ({
                  width: 74,
                  alignItems: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: borderRadius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.14),
                  }}
                >
                  <Icon name={action.icon} size={24} color={m3.colorScheme.primary} />
                </View>
                <Text
                  style={{
                    ...m3.typography.labelSmall,
                    marginTop: spacing[2],
                    textAlign: 'center',
                    color: m3.colorScheme.onSurfaceVariant,
                  }}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </TransitionView>

        <TransitionView style={{ marginTop: spacing[6] }}>
          <Text
            style={{
              ...m3.typography.titleMedium,
              color: m3.colorScheme.onSurface,
              marginBottom: spacing[3],
            }}
          >
            {t('dashboard.recentActivity.title')}
          </Text>
          {activitiesLoading || farmsLoading ? (
            <Card>
              <View style={{ paddingVertical: spacing[6], alignItems: 'center' }}>
                <ActivityIndicator color={m3.colorScheme.primary} />
              </View>
            </Card>
          ) : activities && activities.length > 0 ? (
            <Card padded={false}>
              {activities.map((item, index) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/farm/${item.farmId}`)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                    borderBottomWidth: index === activities.length - 1 ? 0 : 1,
                    borderBottomColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
                  }}
                >
                  <Icon name="clock" size={16} color={m3.colorScheme.onSurfaceVariant} />
                  <View style={{ flex: 1, marginLeft: spacing[2] }}>
                    <Text style={{ ...m3.typography.labelLarge, color: m3.colorScheme.onSurface }}>
                      {item.farmName}
                    </Text>
                    <Text
                      style={{
                        ...m3.typography.labelSmall,
                        color: m3.colorScheme.onSurfaceVariant,
                      }}
                    >
                      {item.description}
                    </Text>
                  </View>
                  <Text
                    style={{
                      ...m3.typography.labelSmall,
                      color: m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {formatDate(new Date(item.date), { month: 'short', day: 'numeric' })}
                  </Text>
                </Pressable>
              ))}
            </Card>
          ) : (
            <Card>
              <Text style={{ ...m3.typography.bodyMedium, color: m3.colorScheme.onSurfaceVariant }}>
                {t('dashboard.empty.recentActivity')}
              </Text>
            </Card>
          )}
        </TransitionView>

        <TransitionView style={{ marginTop: spacing[6] }}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text
                  style={{ ...m3.typography.labelSmall, color: m3.colorScheme.onSurfaceVariant }}
                >
                  {t('dashboard.stats.farms')}
                </Text>
                <Text style={{ ...m3.typography.headlineSmall, color: m3.colorScheme.onSurface }}>
                  {formatNumber(stats?.farmsCount ?? 0, { maximumFractionDigits: 0 })}
                </Text>
              </View>
              <View>
                <Text
                  style={{ ...m3.typography.labelSmall, color: m3.colorScheme.onSurfaceVariant }}
                >
                  {t('dashboard.stats.tasks')}
                </Text>
                <Text style={{ ...m3.typography.headlineSmall, color: m3.colorScheme.onSurface }}>
                  {formatNumber(stats?.pendingTasksCount ?? 0, { maximumFractionDigits: 0 })}
                </Text>
              </View>
            </View>
          </Card>
        </TransitionView>
      </View>
    </ScrollView>
  );
}
