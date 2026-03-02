import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

        {/* Hero: weather + key stats */}
        <TransitionView style={{ marginTop: spacing[5] }}>
          <Card padded={false}>
            <LinearGradient
              colors={[
                colorWithOpacity(m3.colorScheme.primary, 0.18),
                colorWithOpacity(m3.colorScheme.secondary, 0.1),
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: spacing[4] }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1, paddingRight: spacing[4] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon name="sun.max.fill" size={18} color={m3.colorScheme.secondary} />
                    <Text
                      style={{
                        ...m3.typography.labelLarge,
                        marginLeft: spacing[2],
                        color: m3.colorScheme.onSurface,
                      }}
                      numberOfLines={1}
                    >
                      {weatherSummary}
                    </Text>
                  </View>
                  <Text
                    style={{
                      ...m3.typography.bodyMedium,
                      marginTop: spacing[2],
                      color: m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {t('dashboard.quickActions.title')}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: spacing[4] }}>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={{
                        ...m3.typography.labelSmall,
                        color: m3.colorScheme.onSurfaceVariant,
                      }}
                    >
                      {t('dashboard.stats.farms')}
                    </Text>
                    <Text
                      style={{ ...m3.typography.headlineSmall, color: m3.colorScheme.onSurface }}
                    >
                      {formatNumber(stats?.farmsCount ?? 0, { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={{
                        ...m3.typography.labelSmall,
                        color: m3.colorScheme.onSurfaceVariant,
                      }}
                    >
                      {t('dashboard.stats.tasks')}
                    </Text>
                    <Text
                      style={{ ...m3.typography.headlineSmall, color: m3.colorScheme.onSurface }}
                    >
                      {formatNumber(stats?.pendingTasksCount ?? 0, { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing[2],
                  marginTop: spacing[4],
                }}
              >
                {quickActions.map((action) => (
                  <Pressable
                    key={action.key}
                    onPress={() => {
                      tapLight();
                      action.onPress();
                    }}
                    style={({ pressed }) => ({
                      flexGrow: 1,
                      flexBasis: '48%',
                      borderRadius: borderRadius['2xl'],
                      paddingVertical: spacing[3],
                      paddingHorizontal: spacing[3],
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.onSurface, 0.06)
                        : colorWithOpacity(m3.colorScheme.onSurface, 0.04),
                      borderWidth: 1,
                      borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.1),
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: borderRadius.full,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.14),
                          marginRight: spacing[3],
                        }}
                      >
                        <Icon name={action.icon} size={18} color={m3.colorScheme.primary} />
                      </View>
                      <Text
                        style={{
                          ...m3.typography.labelLarge,
                          color: m3.colorScheme.onSurface,
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {action.label}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </LinearGradient>
          </Card>
        </TransitionView>

        <TransitionView style={{ marginTop: spacing[6] }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ ...m3.typography.titleMedium, color: m3.colorScheme.onSurface }}>
              {t('dashboard.stats.farms')}
            </Text>
            <Pressable
              onPress={() => {
                tapLight();
                router.push('/farm/add');
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Text style={{ ...m3.typography.labelLarge, color: m3.colorScheme.primary }}>
                + {t('farms.addFarm')}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: spacing[3] }}
          >
            <View style={{ flexDirection: 'row', gap: spacing[3] }}>
              {(farms ?? []).slice(0, 8).map((farm) => (
                <Card
                  key={farm.id}
                  interactive
                  padded={false}
                  onPress={() => {
                    if (farm.id) router.push(`/farm/${farm.id}`);
                  }}
                  style={{ width: 240 }}
                >
                  <LinearGradient
                    colors={[
                      colorWithOpacity(m3.colorScheme.primary, 0.22),
                      colorWithOpacity(m3.colorScheme.primary, 0.1),
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ padding: spacing[4] }}
                  >
                    <Text style={{ ...m3.typography.titleMedium, color: m3.colorScheme.onSurface }}>
                      {farm.name}
                    </Text>
                    <Text
                      style={{
                        ...m3.typography.bodyMedium,
                        color: m3.colorScheme.onSurfaceVariant,
                        marginTop: spacing[1],
                      }}
                      numberOfLines={1}
                    >
                      {farm.region || t('common.na')}
                    </Text>

                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[4] }}
                    >
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: borderRadius.full,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colorWithOpacity(m3.colorScheme.secondary, 0.18),
                          marginRight: spacing[2],
                        }}
                      >
                        <Icon name="leaf.fill" size={14} color={m3.colorScheme.secondary} />
                      </View>
                      <Text
                        style={{ ...m3.typography.labelLarge, color: m3.colorScheme.onSurface }}
                      >
                        {formatNumber(farm.area ?? 0, { maximumFractionDigits: 1 })} ac
                      </Text>
                    </View>
                  </LinearGradient>
                </Card>
              ))}
              {farms && farms.length === 0 ? (
                <Card interactive onPress={() => router.push('/farm/add')} style={{ width: 240 }}>
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
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                    borderBottomWidth: index === activities.length - 1 ? 0 : 1,
                    borderBottomColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
                    backgroundColor: pressed
                      ? colorWithOpacity(m3.colorScheme.onSurface, 0.04)
                      : 'transparent',
                  })}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: borderRadius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                      marginRight: spacing[3],
                    }}
                  >
                    <Icon name="clock" size={14} color={m3.colorScheme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...m3.typography.labelLarge, color: m3.colorScheme.onSurface }}>
                      {item.farmName}
                    </Text>
                    <Text
                      style={{
                        ...m3.typography.labelSmall,
                        color: m3.colorScheme.onSurfaceVariant,
                      }}
                      numberOfLines={1}
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
      </View>
    </ScrollView>
  );
}
