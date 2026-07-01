import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';
import { formatDate } from '@/i18n/format';
import type { SoilTestRecord } from '@/types/database';
import { soilParamOptions } from '@/constants/lab-test-parameters';
import { getParamStatus } from '@/utils/lab-test-utils';

export interface FarmSoilBaseline {
  soil_texture_class?: string | null;
  sand_percentage?: number | null;
  silt_percentage?: number | null;
  clay_percentage?: number | null;
  cation_exchange_capacity?: number | null;
  soil_water_retention?: number | null;
  bulk_density?: number | null;
}

interface SoilBaselinePanelProps {
  farmSoil?: FarmSoilBaseline | null;
  test?: SoilTestRecord | null;
}

interface SoilChip {
  key: string;
  label: string;
  unit?: string;
  value: number | string | null | undefined;
  status: 'ok' | 'warn' | 'bad';
}

// Farm-level soil fields set during farm creation. Only those with a non-null
// value are surfaced so the panel reflects exactly what was recorded.
const FARM_SOIL_FIELDS: { key: keyof FarmSoilBaseline; label: string; unit?: string }[] = [
  { key: 'soil_texture_class', label: 'Texture' },
  { key: 'sand_percentage', label: 'Sand', unit: '%' },
  { key: 'silt_percentage', label: 'Silt', unit: '%' },
  { key: 'clay_percentage', label: 'Clay', unit: '%' },
  { key: 'cation_exchange_capacity', label: 'CEC', unit: 'meq/100g' },
  { key: 'soil_water_retention', label: 'Water retention', unit: '%' },
  { key: 'bulk_density', label: 'Bulk density', unit: 'g/cm³' },
];

export function SoilBaselinePanel({ farmSoil, test }: SoilBaselinePanelProps) {
  const { t } = useTranslation();
  const m3 = useM3();

  const farmChips = useMemo<SoilChip[]>(() => {
    if (!farmSoil) return [];
    return FARM_SOIL_FIELDS.filter((field) => {
      const value = farmSoil[field.key];
      return value !== null && value !== undefined && value !== '';
    }).map((field) => ({
      key: field.key,
      label: field.label,
      unit: field.unit,
      value: farmSoil[field.key],
      status: 'ok' as const,
    }));
  }, [farmSoil]);

  const testChips = useMemo<SoilChip[]>(() => {
    const raw = test?.parameters ?? {};
    return Object.entries(raw)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => {
        const option = findSoilOption(key);
        return {
          key: `test:${key}`,
          label: option?.shortLabel ?? humanizeKey(key),
          unit: option?.unit,
          value,
          status: option ? getParamStatus(value, option) : ('ok' as const),
        };
      });
  }, [test?.parameters]);

  const chips = [...farmChips, ...testChips];

  const hasFarmData = farmChips.length > 0;
  const hasTestData = testChips.length > 0;

  if (!hasFarmData && !hasTestData) {
    return (
      <View
        style={{
          padding: spacing[4],
          borderRadius: borderRadius.lg,
          backgroundColor: m3.colorScheme.surface,
        }}
      >
        <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
          {t('professional.reviews.noSoilBaseline')}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        borderRadius: borderRadius.lg,
        backgroundColor: m3.colorScheme.surface,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          padding: spacing[3],
          borderBottomWidth: 1,
          borderBottomColor: m3.colorScheme.outlineVariant,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontSize: fontSize.base,
            fontWeight: fontWeight.semibold,
            color: m3.colorScheme.onSurface,
          }}
        >
          {t('professional.reviews.soilBaselineTitle')}
        </Text>
        {test?.date && (
          <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
            {formatDate(test.date, { year: 'numeric', month: 'short', day: 'numeric' })}
          </Text>
        )}
      </View>

      <View style={{ padding: spacing[3] }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
          {chips.map((chip) => (
            <View
              key={chip.key}
              style={{
                paddingVertical: spacing[2],
                paddingHorizontal: spacing[3],
                borderRadius: borderRadius.md,
                backgroundColor: m3.colorScheme.surfaceVariant,
                minWidth: 80,
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.xs,
                  color: m3.colorScheme.onSurfaceVariant,
                }}
              >
                {chip.label}
                {chip.unit ? ` (${chip.unit})` : ''}
              </Text>
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: statusColor(chip.status, m3.colorScheme),
                  marginTop: spacing[1],
                }}
              >
                {formatSoilValue(chip.value)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// Matches a stored parameter key against soilParamOptions on a normalized form
// (alphanumerics only, lowercased) so snake_case / camelCase variants resolve.
function findSoilOption(storedKey: string) {
  const normalize = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = normalize(storedKey);
  return soilParamOptions.find((p) => normalize(p.key) === target);
}

// Turns an arbitrary stored key (e.g. cation_exchange_capacity, waterRetention)
// into a readable label when it isn't a known soilParamOption.
function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSoilValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value ?? '—');
}

function statusColor(status: 'ok' | 'warn' | 'bad', scheme: Record<string, string>): string {
  switch (status) {
    case 'bad':
      return scheme.error;
    case 'warn':
      return scheme.warning;
    case 'ok':
    default:
      return scheme.success;
  }
}
