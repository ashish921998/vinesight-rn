import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, darkColors, fontSize, fontWeight, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';
import { ProductDetailSheet } from '@/components/sheets/product-detail-sheet';
import { useChemicalCatalog } from '@/hooks';
import type { ChemicalMix, ChemicalMixComponent } from '@/types/phi';

export default function SprayCatalogScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const m3 = useM3();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom + spacing[8], spacing[12]);
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'preventive' | 'curative' | 'both'>('all');
  const [selectedPest, setSelectedPest] = useState<string>('all');
  const [selectedComponent, setSelectedComponent] = useState<ChemicalMixComponent | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  const { data: mixes = [], isLoading } = useChemicalCatalog();

  const pestOptions = useMemo(() => {
    const set = new Set<string>();
    const modeMixes =
      modeFilter === 'all' ? mixes : mixes.filter((mix) => mix.application_mode === modeFilter);
    modeMixes.forEach((mix) => {
      if (mix.target_problem) set.add(mix.target_problem);
    });
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [mixes, modeFilter]);

  const effectiveSelectedPest = pestOptions.includes(selectedPest) ? selectedPest : 'all';

  const filteredMixes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return mixes.filter((mix) => {
      if (modeFilter !== 'all' && mix.application_mode !== modeFilter) return false;
      if (effectiveSelectedPest !== 'all' && mix.target_problem !== effectiveSelectedPest)
        return false;
      if (!normalized) return true;
      if (mix.name.toLowerCase().includes(normalized)) return true;
      if ((mix.target_problem ?? '').toLowerCase().includes(normalized)) return true;
      return mix.components.some(
        (component: ChemicalMixComponent) =>
          component.product_name.toLowerCase().includes(normalized) ||
          (component.active_ingredient ?? '').toLowerCase().includes(normalized),
      );
    });
  }, [mixes, modeFilter, effectiveSelectedPest, query]);

  const mixesUsingSelectedProductCount = useMemo(() => {
    if (!selectedComponent) return 0;
    return mixes.filter((mix) =>
      mix.components.some(
        (c: ChemicalMixComponent) => c.product_id === selectedComponent.product_id,
      ),
    ).length;
  }, [mixes, selectedComponent]);

  // Get spray color based on dark mode
  const sprayColor =
    m3.colorScheme.surface === colors.surface[50] ? colors.spray[500] : darkColors.spray[500];

  const renderChip = useCallback(
    (key: string, label: string, selected: boolean, onPress: () => void) => (
      <Pressable
        key={key}
        onPress={onPress}
        style={{
          borderRadius: borderRadius.full,
          borderWidth: 1,
          borderColor: selected ? sprayColor : m3.colorScheme.outlineVariant,
          backgroundColor: selected ? sprayColor : m3.surface.surfaceContainerLow,
          paddingHorizontal: spacing[3] + 1,
          paddingVertical: spacing[2],
          marginRight: spacing[2],
        }}
      >
        <Text
          style={{
            color: selected ? '#ffffff' : m3.colorScheme.onSurface,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
          }}
        >
          {label}
        </Text>
      </Pressable>
    ),
    [m3, sprayColor],
  );

  const renderMixCard = useCallback(
    ({ item: mix }: { item: ChemicalMix }) => {
      // Determine chemical type from components (default to Fungicide)
      const chemicalType = 'Fungicide';

      // Type badge colors based on chemical type
      const getTypeBadgeStyle = (type: string) => {
        const isDark = m3.colorScheme.surface !== colors.surface[50];
        switch (type) {
          case 'Fungicide':
            return {
              backgroundColor: isDark ? 'rgba(138,154,94,0.15)' : 'rgba(108,124,70,0.12)',
              color: isDark ? darkColors.spray[500] : colors.spray[500],
            };
          case 'Insecticide':
            return {
              backgroundColor: isDark ? 'rgba(90,128,144,0.15)' : 'rgba(78,115,132,0.12)',
              color: isDark ? darkColors.info : colors.info,
            };
          case 'Herbicide':
            return {
              backgroundColor: isDark ? 'rgba(154,106,82,0.15)' : 'rgba(166,107,79,0.12)',
              color: isDark ? darkColors.secondary[500] : colors.secondary[500],
            };
          default:
            return {
              backgroundColor: isDark ? 'rgba(138,154,94,0.15)' : 'rgba(108,124,70,0.12)',
              color: isDark ? darkColors.spray[500] : colors.spray[500],
            };
        }
      };

      // Get dose display string from component
      const getDoseDisplay = (component: ChemicalMixComponent): string => {
        if (component.dose_basis === 'per_100_liter') {
          return `${component.dose_value}${component.dose_unit === 'gm' ? 'g' : 'mL'}/100L`;
        } else if (component.dose_basis === 'fixed_per_tank') {
          return `${component.dose_value}${component.dose_unit === 'gm' ? 'g' : 'mL'}/tank`;
        }
        return `${component.dose_value}${component.dose_unit === 'gm' ? 'g' : 'mL'}/L`;
      };

      const typeBadgeStyle = getTypeBadgeStyle(chemicalType);
      const firstComponent = mix.components[0];
      const phiDays = firstComponent?.phi_days;
      const hasPhiWarning = phiDays !== null && phiDays > 0;

      // Get warning color based on dark mode
      const isDark = m3.colorScheme.surface !== colors.surface[50];
      const warningColor = isDark ? darkColors.warning : colors.warning;

      return (
        <View
          style={{
            borderRadius: borderRadius.sm,
            borderWidth: 1,
            borderColor: m3.colorScheme.outlineVariant,
            backgroundColor: m3.surface.surfaceContainerLow,
            flexDirection: 'row',
            marginBottom: spacing[3],
            overflow: 'hidden',
          }}
        >
          {/* Left strip - 3px spray green */}
          <View
            style={{
              width: 3,
              backgroundColor: sprayColor,
              borderRadius: 3,
              borderTopLeftRadius: borderRadius.sm,
              borderBottomLeftRadius: borderRadius.sm,
            }}
          />

          {/* Card body */}
          <View style={{ flex: 1, padding: spacing[4], gap: spacing[2] }}>
            {/* Top row: name + type badge */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] }}>
              <Text
                style={{
                  color: m3.colorScheme.onSurface,
                  fontSize: 15,
                  fontWeight: fontWeight.semibold,
                  flex: 1,
                  lineHeight: 20,
                }}
              >
                {mix.name}
              </Text>
              <View
                style={{
                  backgroundColor: typeBadgeStyle.backgroundColor,
                  paddingHorizontal: spacing[2],
                  paddingVertical: 1,
                  borderRadius: borderRadius.full,
                }}
              >
                <Text
                  style={{
                    color: typeBadgeStyle.color,
                    fontSize: 11,
                    fontWeight: fontWeight.semibold,
                    textTransform: 'uppercase',
                    letterSpacing: 0.3,
                  }}
                >
                  {chemicalType}
                </Text>
              </View>
            </View>

            {/* Info row: PHI / Dose / Target */}
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              {phiDays !== null && (
                <>
                  <Text style={{ color: m3.colorScheme.onSurfaceVariant, fontSize: 13 }}>
                    PHI: {phiDays} days
                  </Text>
                  <View
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: 1.5,
                      backgroundColor: m3.colorScheme.onSurfaceVariant,
                      marginHorizontal: spacing[2],
                      opacity: 0.6,
                    }}
                  />
                </>
              )}
              {firstComponent && (
                <>
                  <Text style={{ color: m3.colorScheme.onSurfaceVariant, fontSize: 13 }}>
                    Dose: {getDoseDisplay(firstComponent)}
                  </Text>
                  <View
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: 1.5,
                      backgroundColor: m3.colorScheme.onSurfaceVariant,
                      marginHorizontal: spacing[2],
                      opacity: 0.6,
                    }}
                  />
                </>
              )}
              <Text style={{ color: m3.colorScheme.onSurfaceVariant, fontSize: 13 }}>
                {mix.target_problem ??
                  t('sprayCatalog.genericProblem', { defaultValue: 'General protection' })}
              </Text>
            </View>

            {/* Last used - placeholder since we don't have this data */}
            <Text style={{ color: m3.colorScheme.onSurfaceVariant, fontSize: 13 }}>
              {mix.source_page
                ? t('sprayCatalog.sourcePage', {
                    defaultValue: 'Page {{page}}',
                    page: mix.source_page,
                  })
                : t('sprayCatalog.inLibrary', { defaultValue: 'In your library' })}
            </Text>

            {/* PHI Warning banner - shown when PHI is active (within harvest safety window) */}
            {hasPhiWarning && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[1] + 2,
                  paddingVertical: spacing[1] + 1,
                  paddingHorizontal: spacing[2] + 2,
                  backgroundColor: colorWithOpacity(warningColor, 0.1),
                  borderWidth: 1,
                  borderColor: colorWithOpacity(warningColor, 0.25),
                  borderRadius: borderRadius.xs,
                  alignSelf: 'flex-start',
                }}
              >
                <Ionicons name="warning" size={14} color={warningColor} />
                <Text style={{ color: warningColor, fontSize: 12, fontWeight: fontWeight.medium }}>
                  {t('sprayCatalog.phiActive', { defaultValue: 'PHI active' })}
                </Text>
              </View>
            )}

            {/* Tank Mix Calculator button */}
            <Pressable
              onPress={() =>
                router.push({ pathname: '/calculator/tank-mix', params: { mixId: String(mix.id) } })
              }
              style={{
                marginTop: spacing[2],
                borderRadius: borderRadius.full,
                alignSelf: 'flex-start',
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
              }}
            >
              <Text style={{ color: m3.colorScheme.primary, fontWeight: fontWeight.semibold }}>
                {t('sprayCatalog.openTankMix', { defaultValue: 'Open in Tank Mix Calculator' })}
              </Text>
            </Pressable>

            {/* Component list - clickable to show product details */}
            {mix.components.length > 1 && (
              <View style={{ marginTop: spacing[2], gap: spacing[1] }}>
                {mix.components.slice(1).map((component: ChemicalMixComponent) => (
                  <Pressable
                    key={component.id}
                    onPress={() => {
                      setSelectedComponent(component);
                      setShowSheet(true);
                    }}
                  >
                    <Text style={{ color: m3.colorScheme.primary }}>
                      + {component.product_name} ({getDoseDisplay(component)})
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      );
    },
    [m3, router, t, sprayColor],
  );

  const listHeader = useMemo(
    () => (
      <>
        <Text style={{ ...m3.typography.headlineSmall, color: m3.colorScheme.onSurface }}>
          {t('sprayCatalog.title', { defaultValue: 'Spray Catalog' })}
        </Text>
        <Text style={{ ...m3.typography.bodyMedium, color: m3.colorScheme.onSurfaceVariant }}>
          {t('sprayCatalog.subtitle', {
            defaultValue: 'Browse catalog mixes by pest and mode with direct tank-mix actions.',
          })}
        </Text>

        <View style={{ marginTop: spacing[3] }}>
          <View
            style={{
              borderRadius: borderRadius.sm,
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
              backgroundColor: m3.surface.surfaceContainerLow,
              height: 44,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing[4],
            }}
          >
            <Ionicons
              name="search"
              size={18}
              color={m3.colorScheme.onSurfaceVariant}
              style={{ marginRight: spacing[2] }}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('sprayCatalog.searchPlaceholder', {
                defaultValue: 'Search chemicals, targets, ingredients...',
              })}
              placeholderTextColor={m3.colorScheme.onSurfaceVariant}
              style={{
                flex: 1,
                color: m3.colorScheme.onSurface,
                fontSize: fontSize.base,
                paddingVertical: 0,
              }}
            />
          </View>
        </View>

        <Text
          style={{
            color: m3.colorScheme.onSurfaceVariant,
            marginTop: spacing[3],
            marginBottom: spacing[2],
          }}
        >
          {t('sprayCatalog.modeFilter', { defaultValue: 'Application mode' })}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: spacing[2] }}
        >
          {renderChip(
            'all',
            t('sprayCatalog.modeAll', { defaultValue: 'All' }),
            modeFilter === 'all',
            () => setModeFilter('all'),
          )}
          {renderChip(
            'preventive',
            t('sprayCatalog.modePreventive', { defaultValue: 'Preventive' }),
            modeFilter === 'preventive',
            () => setModeFilter('preventive'),
          )}
          {renderChip(
            'curative',
            t('sprayCatalog.modeCurative', { defaultValue: 'Curative' }),
            modeFilter === 'curative',
            () => setModeFilter('curative'),
          )}
          {renderChip(
            'both',
            t('sprayCatalog.modeBoth', { defaultValue: 'Both' }),
            modeFilter === 'both',
            () => setModeFilter('both'),
          )}
        </ScrollView>

        <Text
          style={{
            color: m3.colorScheme.onSurfaceVariant,
            marginTop: spacing[1],
            marginBottom: spacing[2],
          }}
        >
          {t('sprayCatalog.pestFilter', { defaultValue: 'Target pest/problem' })}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: spacing[3] }}
        >
          {pestOptions.map((pest) =>
            renderChip(
              pest,
              pest === 'all' ? t('sprayCatalog.modeAll', { defaultValue: 'All' }) : pest,
              effectiveSelectedPest === pest,
              () => setSelectedPest(pest),
            ),
          )}
        </ScrollView>

        {isLoading ? (
          <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginBottom: spacing[3] }}>
            {t('common.loading', { defaultValue: 'Loading…' })}
          </Text>
        ) : null}
      </>
    ),
    [effectiveSelectedPest, isLoading, m3, modeFilter, pestOptions, query, renderChip, t],
  );

  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}>
      <Stack.Screen
        options={{ title: t('sprayCatalog.title', { defaultValue: 'Spray Catalog' }) }}
      />
      <FlatList
        data={isLoading ? [] : filteredMixes}
        keyExtractor={(mix) => String(mix.id)}
        renderItem={renderMixCard}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={8}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing[4], paddingBottom: bottomPadding }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
              {t('common.noResultsFound', { defaultValue: 'No results found' })}
            </Text>
          ) : null
        }
      />

      <ProductDetailSheet
        visible={showSheet}
        component={selectedComponent}
        mixesUsingProductCount={mixesUsingSelectedProductCount}
        onClose={() => setShowSheet(false)}
      />
    </View>
  );
}
