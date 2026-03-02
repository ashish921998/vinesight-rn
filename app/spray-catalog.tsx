import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { borderRadius, fontWeight, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';
import { ProductDetailSheet } from '@/components/sheets/product-detail-sheet';
import { useChemicalCatalog } from '@/hooks';
import type { ChemicalMixComponent } from '@/types/phi';

export default function SprayCatalogScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const m3 = useM3();
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'preventive' | 'curative' | 'both'>('all');
  const [selectedPest, setSelectedPest] = useState<string>('all');
  const [selectedComponent, setSelectedComponent] = useState<ChemicalMixComponent | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  const { data: mixes = [], isLoading } = useChemicalCatalog();

  const pestOptions = useMemo(() => {
    const set = new Set<string>();
    mixes.forEach((mix) => {
      if (mix.target_problem) set.add(mix.target_problem);
    });
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [mixes]);

  const filteredMixes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return mixes.filter((mix) => {
      if (modeFilter !== 'all' && mix.application_mode !== modeFilter) return false;
      if (selectedPest !== 'all' && mix.target_problem !== selectedPest) return false;
      if (!normalized) return true;
      if (mix.name.toLowerCase().includes(normalized)) return true;
      if ((mix.target_problem ?? '').toLowerCase().includes(normalized)) return true;
      return mix.components.some(
        (component) =>
          component.product_name.toLowerCase().includes(normalized) ||
          (component.active_ingredient ?? '').toLowerCase().includes(normalized),
      );
    });
  }, [mixes, modeFilter, selectedPest, query]);

  const mixesUsingSelectedProductCount = useMemo(() => {
    if (!selectedComponent) return 0;
    return mixes.filter((mix) =>
      mix.components.some((c) => c.product_id === selectedComponent.product_id),
    ).length;
  }, [mixes, selectedComponent]);

  const renderChip = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={{
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: selected ? m3.colorScheme.primary : m3.colorScheme.outlineVariant,
        backgroundColor: selected
          ? colorWithOpacity(m3.colorScheme.primary, 0.12)
          : m3.surface.surfaceContainerLow,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        marginRight: spacing[2],
      }}
    >
      <Text style={{ color: selected ? m3.colorScheme.primary : m3.colorScheme.onSurface }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}
      contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[10] }}
    >
      <Text style={{ ...m3.typography.headlineSmall, color: m3.colorScheme.onSurface }}>
        {t('sprayCatalog.title', { defaultValue: 'Spray Catalog' })}
      </Text>
      <Text style={{ ...m3.typography.bodyMedium, color: m3.colorScheme.onSurfaceVariant }}>
        {t('sprayCatalog.subtitle', {
          defaultValue:
            'Browse catalog mixes by pest, mode, and cost with direct tank-mix actions.',
        })}
      </Text>

      <View style={{ marginTop: spacing[3] }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('sprayCatalog.searchPlaceholder', {
            defaultValue: 'Search mix, pest, or product',
          })}
          placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
          style={{
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: m3.colorScheme.outlineVariant,
            backgroundColor: m3.surface.surfaceContainerLow,
            color: m3.colorScheme.onSurface,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[3],
          }}
        />
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
            selectedPest === pest,
            () => setSelectedPest(pest),
          ),
        )}
      </ScrollView>

      {isLoading ? (
        <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
          {t('common.loading', { defaultValue: 'Loading…' })}
        </Text>
      ) : (
        filteredMixes.map((mix) => (
          <View
            key={mix.id}
            style={{
              borderRadius: borderRadius.xl,
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
              backgroundColor: m3.surface.surfaceContainerLow,
              padding: spacing[4],
              marginBottom: spacing[3],
            }}
          >
            <Text style={{ color: m3.colorScheme.onSurface, fontWeight: fontWeight.semibold }}>
              {mix.name}
            </Text>
            <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: spacing[1] }}>
              {mix.target_problem ??
                t('sprayCatalog.genericProblem', { defaultValue: 'General protection' })}
            </Text>
            <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: spacing[1] }}>
              {t('sprayCatalog.modeLabel', {
                defaultValue: 'Mode: {{mode}}',
                mode: mix.application_mode ?? 'unspecified',
              })}
            </Text>
            <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: spacing[1] }}>
              {t('sprayCatalog.cost200l', {
                defaultValue: 'Estimated 200L cost: {{value}}',
                value:
                  mix.estimated_cost_per_200l != null ? `INR ${mix.estimated_cost_per_200l}` : '—',
              })}
            </Text>

            <View style={{ marginTop: spacing[2], gap: spacing[1] }}>
              {mix.components.map((component) => (
                <Pressable
                  key={component.id}
                  onPress={() => {
                    setSelectedComponent(component);
                    setShowSheet(true);
                  }}
                >
                  <Text style={{ color: m3.colorScheme.primary }}>
                    • {component.product_name} ({component.dose_value} {component.dose_unit}/L)
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() =>
                router.push({ pathname: '/calculator/tank-mix', params: { mixId: String(mix.id) } })
              }
              style={{
                marginTop: spacing[3],
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
          </View>
        ))
      )}

      <ProductDetailSheet
        visible={showSheet}
        component={selectedComponent}
        mixesUsingProductCount={mixesUsingSelectedProductCount}
        onClose={() => setShowSheet(false)}
      />
    </ScrollView>
  );
}
