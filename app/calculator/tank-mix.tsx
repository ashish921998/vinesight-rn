import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useChemicalCatalog } from '@/hooks';
import { computeTankMixQuantities } from '@/services/phi-service';
import type { ChemicalMix } from '@/types/phi';

export default function TankMixCalculatorScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ mixId?: string }>();
  const m3 = useM3();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom + spacing[8], spacing[12]);
  const [query, setQuery] = useState('');
  const [tankLitersText, setTankLitersText] = useState('200');
  const preselectedMixId = Number.parseInt(params.mixId ?? '', 10);
  const [selectedMixId, setSelectedMixId] = useState<number | null>(
    Number.isFinite(preselectedMixId) ? preselectedMixId : null,
  );

  const tankLiters = Number.parseFloat(tankLitersText);
  const { data: catalogMixes = [], isLoading } = useChemicalCatalog();
  const mixes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return catalogMixes;
    return catalogMixes.filter((mix) => {
      if (mix.name.toLowerCase().includes(normalized)) return true;
      if ((mix.target_problem ?? '').toLowerCase().includes(normalized)) return true;
      return mix.components.some(
        (component) =>
          component.product_name.toLowerCase().includes(normalized) ||
          (component.active_ingredient ?? '').toLowerCase().includes(normalized),
      );
    });
  }, [catalogMixes, query]);
  const selectedMix: ChemicalMix | null = useMemo(
    () => catalogMixes.find((entry) => entry.id === selectedMixId) ?? null,
    [catalogMixes, selectedMixId],
  );
  const rows = useMemo(
    () =>
      selectedMix && Number.isFinite(tankLiters)
        ? computeTankMixQuantities(selectedMix, tankLiters)
        : [],
    [selectedMix, tankLiters],
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}
      contentContainerStyle={{ padding: spacing[4], paddingBottom: bottomPadding }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ marginBottom: spacing[4] }}>
        <Text style={{ ...m3.typography.headlineSmall, color: m3.colorScheme.onSurface }}>
          {t('tankMix.title', { defaultValue: 'Tank Mix Calculator' })}
        </Text>
        <Text style={{ ...m3.typography.bodyMedium, color: m3.colorScheme.onSurfaceVariant }}>
          {t('tankMix.subtitle', {
            defaultValue: 'Select a catalog mix and calculate exact quantities for your tank size.',
          })}
        </Text>
      </View>

      <View style={{ marginBottom: spacing[3] }}>
        <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginBottom: spacing[2] }}>
          {t('tankMix.searchLabel', { defaultValue: 'Search mix' })}
        </Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('tankMix.searchPlaceholder', { defaultValue: 'Search by mix or problem' })}
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

      <View style={{ marginBottom: spacing[4] }}>
        <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginBottom: spacing[2] }}>
          {t('tankMix.tankSizeLabel', { defaultValue: 'Tank size (liters)' })}
        </Text>
        <TextInput
          value={tankLitersText}
          onChangeText={(text) => setTankLitersText(text.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="200"
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
          marginBottom: spacing[2],
          fontSize: fontSize.xs,
          fontWeight: fontWeight.semibold,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        {t('tankMix.catalogMixes', { defaultValue: 'Catalog mixes' })}
      </Text>

      <View style={{ marginBottom: spacing[4] }}>
        {isLoading ? (
          <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
            {t('common.loading', { defaultValue: 'Loading…' })}
          </Text>
        ) : (
          mixes.slice(0, 20).map((mix) => {
            const selected = selectedMix?.id === mix.id;
            return (
              <Pressable
                key={mix.id}
                onPress={() => setSelectedMixId(mix.id)}
                style={{
                  borderRadius: borderRadius.lg,
                  borderWidth: 1,
                  borderColor: selected ? m3.colorScheme.primary : m3.colorScheme.outlineVariant,
                  backgroundColor: selected
                    ? colorWithOpacity(m3.colorScheme.primary, 0.1)
                    : m3.surface.surfaceContainerLow,
                  padding: spacing[3],
                  marginBottom: spacing[2],
                }}
              >
                <Text style={{ color: m3.colorScheme.onSurface, fontWeight: fontWeight.semibold }}>
                  {mix.name}
                </Text>
                <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: 2 }}>
                  {mix.target_problem ??
                    t('tankMix.genericProblem', { defaultValue: 'General protection' })}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>

      {selectedMix && Number.isFinite(tankLiters) && tankLiters > 0 ? (
        <View
          style={{
            borderRadius: borderRadius.xl,
            borderWidth: 1,
            borderColor: m3.colorScheme.outlineVariant,
            backgroundColor: m3.surface.surfaceContainerLow,
            padding: spacing[4],
          }}
        >
          <Text
            style={{
              color: m3.colorScheme.onSurface,
              ...m3.typography.titleMedium,
              marginBottom: spacing[3],
            }}
          >
            {t('tankMix.resultTitle', {
              defaultValue: 'Required quantities for {{liters}}L',
              liters: tankLiters.toFixed(0),
            })}
          </Text>
          {rows.map((row) => (
            <View
              key={row.componentId}
              style={{
                borderRadius: borderRadius.lg,
                padding: spacing[3],
                marginBottom: spacing[2],
                backgroundColor: colorWithOpacity(colors.spray[500], 0.08),
              }}
            >
              <Text style={{ color: m3.colorScheme.onSurface, fontWeight: fontWeight.semibold }}>
                {row.productName}
              </Text>
              <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: 2 }}>
                {t('tankMix.resultDose', {
                  defaultValue: 'Dose: {{value}} {{unit}} ({{basis}})',
                  value: row.doseValue,
                  unit: row.doseUnit,
                  basis: row.doseBasis,
                })}
              </Text>
              <Text
                style={{
                  color: colors.spray[500],
                  marginTop: spacing[1],
                  fontWeight: fontWeight.semibold,
                }}
              >
                {t('tankMix.resultTotal', {
                  defaultValue: 'Total: {{value}} {{unit}}',
                  value: row.totalQuantity,
                  unit: row.doseUnit,
                })}
              </Text>
            </View>
          ))}
          <Pressable
            onPress={async () => {
              if (!selectedMix) return;
              const lines = rows.map(
                (row) => `${row.productName}: ${row.totalQuantity}${row.doseUnit}`,
              );
              const text = [`${selectedMix.name} - ${tankLiters.toFixed(0)}L`, ...lines].join('\n');
              await Share.share({ message: text });
            }}
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
              {t('tankMix.shareSummary', { defaultValue: 'Share mix summary' })}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}
