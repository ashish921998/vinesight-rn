import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { borderRadius, fontWeight, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';
import { useChemicalMixSearch } from '@/hooks';
import { computeTankMixCostSummary } from '@/services/phi-service';
import type { ChemicalMix } from '@/types/phi';

function safeNumber(text: string): number {
  const value = Number.parseFloat(text);
  return Number.isFinite(value) ? value : 0;
}

export default function SprayCostCalculatorScreen() {
  const { t } = useTranslation();
  const m3 = useM3();
  const [query, setQuery] = useState('');
  const [tankLitersText, setTankLitersText] = useState('200');
  const [areaAcresText, setAreaAcresText] = useState('1');
  const [volumePerAcreText, setVolumePerAcreText] = useState('200');
  const [selectedMix, setSelectedMix] = useState<ChemicalMix | null>(null);

  const tankLiters = safeNumber(tankLitersText);
  const areaAcres = safeNumber(areaAcresText);
  const volumePerAcre = safeNumber(volumePerAcreText);
  const { data: mixes = [], isLoading } = useChemicalMixSearch(query);

  const tankSummary = useMemo(
    () =>
      selectedMix && tankLiters > 0
        ? computeTankMixCostSummary(selectedMix, tankLiters)
        : { rows: [], totalCost: null, currency: null },
    [selectedMix, tankLiters],
  );

  const farmSummary = useMemo(() => {
    if (!tankSummary.totalCost || tankLiters <= 0 || areaAcres <= 0 || volumePerAcre <= 0) {
      return { totalLiters: 0, tankCount: 0, totalCost: null };
    }
    const totalLiters = areaAcres * volumePerAcre;
    const tankCount = totalLiters / tankLiters;
    const totalCost = tankSummary.totalCost * tankCount;
    return { totalLiters, tankCount, totalCost };
  }, [tankSummary.totalCost, tankLiters, areaAcres, volumePerAcre]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}
      contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[10] }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ ...m3.typography.headlineSmall, color: m3.colorScheme.onSurface }}>
        {t('sprayCost.title', { defaultValue: 'Spray Cost Calculator' })}
      </Text>
      <Text style={{ ...m3.typography.bodyMedium, color: m3.colorScheme.onSurfaceVariant }}>
        {t('sprayCost.subtitle', {
          defaultValue: 'Estimate spray cost by tank, area, and application volume.',
        })}
      </Text>

      <View style={{ marginTop: spacing[3], gap: spacing[3] }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('sprayCost.searchPlaceholder', { defaultValue: 'Search catalog mix' })}
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
        <TextInput
          value={tankLitersText}
          onChangeText={(text) => setTankLitersText(text.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder={t('sprayCost.tankLiters', { defaultValue: 'Tank liters' })}
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
        <TextInput
          value={areaAcresText}
          onChangeText={(text) => setAreaAcresText(text.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder={t('sprayCost.areaAcres', { defaultValue: 'Area (acres)' })}
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
        <TextInput
          value={volumePerAcreText}
          onChangeText={(text) => setVolumePerAcreText(text.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder={t('sprayCost.volumePerAcre', { defaultValue: 'Spray volume per acre (L)' })}
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
        {t('sprayCost.catalogMixes', { defaultValue: 'Catalog mixes' })}
      </Text>
      <View style={{ marginBottom: spacing[4] }}>
        {isLoading ? (
          <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
            {t('common.loading', { defaultValue: 'Loading…' })}
          </Text>
        ) : (
          mixes.slice(0, 30).map((mix) => (
            <Pressable
              key={mix.id}
              onPress={() => setSelectedMix(mix)}
              style={{
                borderRadius: borderRadius.lg,
                borderWidth: 1,
                borderColor:
                  selectedMix?.id === mix.id
                    ? m3.colorScheme.primary
                    : m3.colorScheme.outlineVariant,
                backgroundColor:
                  selectedMix?.id === mix.id
                    ? colorWithOpacity(m3.colorScheme.primary, 0.1)
                    : m3.surface.surfaceContainerLow,
                padding: spacing[3],
                marginBottom: spacing[2],
              }}
            >
              <Text style={{ color: m3.colorScheme.onSurface, fontWeight: fontWeight.semibold }}>
                {mix.name}
              </Text>
              <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
                {mix.target_problem ?? '—'}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      {selectedMix ? (
        <View
          style={{
            borderRadius: borderRadius.xl,
            borderWidth: 1,
            borderColor: m3.colorScheme.outlineVariant,
            backgroundColor: m3.surface.surfaceContainerLow,
            padding: spacing[4],
            gap: spacing[1],
          }}
        >
          <Text style={{ ...m3.typography.titleMedium, color: m3.colorScheme.onSurface }}>
            {selectedMix.name}
          </Text>
          <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
            {t('sprayCost.perTank', {
              defaultValue: 'Per tank cost: {{currency}} {{value}}',
              currency: tankSummary.currency ?? 'INR',
              value: tankSummary.totalCost ?? '—',
            })}
          </Text>
          <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
            {t('sprayCost.totalLiters', {
              defaultValue: 'Total spray volume: {{value}} L',
              value: farmSummary.totalLiters || '—',
            })}
          </Text>
          <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
            {t('sprayCost.tankCount', {
              defaultValue: 'Tank count needed: {{value}}',
              value: farmSummary.tankCount ? farmSummary.tankCount.toFixed(2) : '—',
            })}
          </Text>
          <Text
            style={{
              color: m3.colorScheme.primary,
              fontWeight: fontWeight.bold,
              marginTop: spacing[1],
            }}
          >
            {t('sprayCost.totalCost', {
              defaultValue: 'Estimated total cost: {{currency}} {{value}}',
              currency: tankSummary.currency ?? 'INR',
              value: farmSummary.totalCost != null ? farmSummary.totalCost.toFixed(2) : '—',
            })}
          </Text>

          <View style={{ marginTop: spacing[2], gap: spacing[1] }}>
            {tankSummary.rows.map((row) => (
              <Text key={row.componentId} style={{ color: m3.colorScheme.onSurfaceVariant }}>
                • {row.productName}: {row.totalQuantity} {row.doseUnit}
                {row.packagingSize ? ` · ${row.packagingSize}` : ''}
                {row.packageCount != null ? ` · ${row.packageCount.toFixed(2)} pack` : ''}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
