import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatLocalDate, parseDbDateToLocalDate } from '@/utils/date';
import {
  useChemicalCatalog,
  useFarms,
  useFarmSeasonStatus,
  useSafeToSprayMatrix,
  useUpdateFarmSeasonTargetHarvestDate,
} from '@/hooks';

export default function SpraySafeCheckerScreen() {
  const { t } = useTranslation();
  const m3 = useM3();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string }>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [iosPickerDraftDate, setIosPickerDraftDate] = useState<Date>(new Date());
  const [targetDateOverride, setTargetDateOverride] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { data: farms = [] } = useFarms();
  const { data: catalogMixes = [], isLoading: isCatalogLoading } = useChemicalCatalog();
  const initialFarmId = params.farmId ? Number.parseInt(params.farmId, 10) : null;
  const activeFarmId = Number.isFinite(initialFarmId ?? NaN)
    ? initialFarmId
    : (farms[0]?.id ?? null);
  const { activeSeason } = useFarmSeasonStatus(activeFarmId ?? undefined);
  const updateTargetHarvestDate = useUpdateFarmSeasonTargetHarvestDate();
  const targetDate =
    targetDateOverride ?? activeSeason?.target_harvest_date ?? formatLocalDate(new Date());
  const targetDateLabel = useMemo(() => {
    const parsed = parseDbDateToLocalDate(targetDate);
    if (!parsed) return targetDate;
    return parsed.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, [targetDate]);

  const matrixQuery = useSafeToSprayMatrix({
    farmId: activeFarmId ?? undefined,
    seasonId: activeSeason?.id ?? null,
    targetHarvestDate: targetDate,
  });

  const catalogMixById = useMemo(
    () => new Map(catalogMixes.map((mix) => [mix.id, mix])),
    [catalogMixes],
  );

  const filteredStatuses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const statuses = matrixQuery.data ?? [];
    if (!normalized) return statuses;

    return statuses.filter((item) => {
      if (item.mixName.toLowerCase().includes(normalized)) return true;

      const mix = catalogMixById.get(item.mixId);
      if (!mix) return false;
      if ((mix.target_problem ?? '').toLowerCase().includes(normalized)) return true;

      return mix.components.some(
        (component) =>
          component.product_name.toLowerCase().includes(normalized) ||
          (component.active_ingredient ?? '').toLowerCase().includes(normalized),
      );
    });
  }, [catalogMixById, matrixQuery.data, query]);

  const statusColors = useMemo(
    () => ({
      green: { bg: colorWithOpacity('#2E7D32', 0.12), fg: '#2E7D32' },
      yellow: { bg: colorWithOpacity('#F9A825', 0.18), fg: '#8A6A00' },
      red: { bg: colorWithOpacity('#D32F2F', 0.12), fg: '#B3261E' },
      unverified: {
        bg: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
        fg: m3.colorScheme.onSurfaceVariant,
      },
    }),
    [m3.colorScheme.onSurfaceVariant],
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Custom JS header (avoids iOS 26 native bar-button glass capsule) */}
      <View style={{ paddingTop: insets.top, backgroundColor: m3.colorScheme.surface }}>
        <View
          style={{
            height: 56,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing[2],
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              backgroundColor: 'transparent',
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('common.goBack')}
          >
            {({ pressed }) => (
              <View
                style={{
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UiSymbol name="chevron.left" size={22} color={m3.colorScheme.onSurface} />
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      borderRadius: 22,
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                        : 'transparent',
                    },
                  ]}
                />
              </View>
            )}
          </Pressable>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              numberOfLines={1}
              style={{
                color: m3.colorScheme.onSurface,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
              }}
            >
              {t('safeToSpray.title', { defaultValue: 'Safe-to-Spray Checker' })}
            </Text>
          </View>

          <View style={{ width: 44, height: 44 }} />
        </View>
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: spacing[4],
          paddingTop: spacing[4],
          paddingBottom: Math.max(insets.bottom + spacing[6], spacing[10]),
        }}
      >
        <Text style={{ ...m3.typography.headlineSmall, color: m3.colorScheme.onSurface }}>
          {t('safeToSpray.title', { defaultValue: 'Safe-to-Spray Checker' })}
        </Text>
        <Text style={{ ...m3.typography.bodyMedium, color: m3.colorScheme.onSurfaceVariant }}>
          {t('safeToSpray.subtitle', {
            defaultValue:
              'Enter target harvest date to see which catalog sprays are safe to apply today.',
          })}
        </Text>

        <View style={{ marginTop: spacing[3] }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: m3.surface.surfaceContainerLow,
              borderRadius: borderRadius.xl,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
            }}
          >
            <UiSymbol name="magnifyingglass" size={18} color={m3.colorScheme.onSurfaceVariant} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('safeToSpray.searchPlaceholder', {
                defaultValue: 'Search mix, pest, or product',
              })}
              accessibilityLabel={t('safeToSpray.searchLabel', {
                defaultValue: 'Search mix, pest, or product',
              })}
              placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
              style={{
                flex: 1,
                marginLeft: spacing[2],
                color: m3.colorScheme.onSurface,
              }}
            />
            {query !== '' ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityLabel={t('common.clearSearch', { defaultValue: 'Clear search' })}
              >
                <UiSymbol
                  name="xmark.circle.fill"
                  size={18}
                  color={m3.colorScheme.onSurfaceVariant}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={{ marginTop: spacing[4], marginBottom: spacing[3] }}>
          <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginBottom: spacing[2] }}>
            {t('safeToSpray.targetDate', { defaultValue: 'Target harvest date' })}
          </Text>
          <Pressable
            onPress={() => {
              const initial = parseDbDateToLocalDate(targetDate) ?? new Date();
              if (Platform.OS === 'ios') {
                setIosPickerDraftDate(initial);
              }
              setShowDatePicker(true);
            }}
            style={{
              borderRadius: borderRadius.lg,
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
              backgroundColor: m3.surface.surfaceContainerLow,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[3],
            }}
          >
            <Text style={{ color: m3.colorScheme.onSurface }}>{targetDateLabel}</Text>
          </Pressable>
        </View>

        {showDatePicker && Platform.OS !== 'ios' ? (
          <DateTimePicker
            value={parseDbDateToLocalDate(targetDate) ?? new Date()}
            mode="date"
            display="default"
            onChange={(_, selected) => {
              setShowDatePicker(false);
              if (!selected) return;
              setTargetDateOverride(formatLocalDate(selected));
            }}
          />
        ) : null}

        {Platform.OS === 'ios' ? (
          <Modal
            visible={showDatePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <Pressable
              onPress={() => setShowDatePicker(false)}
              style={{
                flex: 1,
                justifyContent: 'center',
                backgroundColor: colorWithOpacity('#000000', 0.2),
                padding: spacing[4],
              }}
            >
              <Pressable
                onPress={(event) => event.stopPropagation()}
                style={{
                  borderRadius: borderRadius.xl,
                  backgroundColor: m3.colorScheme.surface,
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                  padding: spacing[3],
                }}
              >
                <DateTimePicker
                  value={iosPickerDraftDate}
                  mode="date"
                  display="spinner"
                  onChange={(_, selected) => {
                    if (selected) setIosPickerDraftDate(selected);
                  }}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    gap: spacing[2],
                    marginTop: spacing[2],
                  }}
                >
                  <Pressable
                    onPress={() => setShowDatePicker(false)}
                    style={{
                      borderRadius: borderRadius.full,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      backgroundColor: m3.surface.surfaceContainerHigh,
                    }}
                  >
                    <Text style={{ color: m3.colorScheme.onSurface }}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setTargetDateOverride(formatLocalDate(iosPickerDraftDate));
                      setShowDatePicker(false);
                    }}
                    style={{
                      borderRadius: borderRadius.full,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.14),
                    }}
                  >
                    <Text
                      style={{ color: m3.colorScheme.primary, fontWeight: fontWeight.semibold }}
                    >
                      {t('common.done')}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        ) : null}

        {activeSeason?.id ? (
          <Pressable
            disabled={updateTargetHarvestDate.isPending}
            onPress={() => {
              const seasonId = activeSeason.id;
              if (!seasonId) return;
              updateTargetHarvestDate.mutate({
                id: seasonId,
                farmId: activeSeason.farm_id,
                targetHarvestDate: targetDate,
              });
            }}
            style={{
              borderRadius: borderRadius.full,
              alignSelf: 'flex-start',
              backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.14),
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              marginBottom: spacing[4],
            }}
          >
            <Text style={{ color: m3.colorScheme.primary, fontWeight: fontWeight.semibold }}>
              {t('safeToSpray.saveSeasonTarget', { defaultValue: 'Save target date to season' })}
            </Text>
          </Pressable>
        ) : null}

        {matrixQuery.isLoading || isCatalogLoading ? (
          <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
            {t('common.loading', { defaultValue: 'Loading…' })}
          </Text>
        ) : filteredStatuses.length === 0 && query.trim() ? (
          <View style={{ marginTop: spacing[2] }}>
            <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
              {t('common.noResultsFound', { defaultValue: 'No results found' })}
            </Text>
            <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: spacing[1] }}>
              {t('common.tryDifferentSearchTerm', { defaultValue: 'Try a different search term' })}
            </Text>
          </View>
        ) : (
          filteredStatuses.map((item) => {
            const style = statusColors[item.status];
            return (
              <View
                key={item.mixId}
                style={{
                  borderRadius: borderRadius.xl,
                  borderWidth: 1,
                  borderColor: colorWithOpacity(style.fg, 0.3),
                  backgroundColor: style.bg,
                  padding: spacing[4],
                  marginBottom: spacing[3],
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text
                    style={{ color: m3.colorScheme.onSurface, fontWeight: fontWeight.semibold }}
                  >
                    {item.mixName}
                  </Text>
                  <Text style={{ color: style.fg, fontWeight: fontWeight.semibold }}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
                {item.status === 'unverified' ? (
                  <Text
                    style={{
                      color: style.fg,
                      marginTop: spacing[1],
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    {t('safeToSpray.unverifiedNotice', {
                      defaultValue: 'No verified PHI data available for this mix.',
                    })}
                  </Text>
                ) : (
                  <>
                    <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: spacing[1] }}>
                      {t('safeToSpray.blocking', {
                        defaultValue: 'Governing PHI: {{days}} days ({{component}})',
                        days: item.governingPhiDays ?? '—',
                        component: item.blockingComponentName ?? '—',
                      })}
                    </Text>
                    <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: spacing[1] }}>
                      {t('safeToSpray.latestDate', {
                        defaultValue: 'Latest safe spray date: {{date}}',
                        date: item.latestSafeSprayDate ?? '—',
                      })}
                    </Text>
                    <Text
                      style={{
                        color: style.fg,
                        marginTop: spacing[1],
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      {(item.daysUntilWindowEnds ?? -1) >= 0
                        ? t('safeToSpray.daysLeft', {
                            defaultValue: '{{count}} day(s) left',
                            count: item.daysUntilWindowEnds ?? 0,
                          })
                        : t('safeToSpray.windowPassed', {
                            defaultValue: 'Window passed by {{count}} day(s)',
                            count: Math.abs(item.daysUntilWindowEnds ?? 0),
                          })}
                    </Text>
                  </>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </>
  );
}
