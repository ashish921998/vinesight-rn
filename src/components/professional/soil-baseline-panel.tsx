import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';
import { formatDate } from '@/i18n/format';
import type { SoilTestRecord } from '@/types/database';
import { soilParamOptions } from '@/constants/lab-test-parameters';
import { getParamStatus } from '@/utils/lab-test-utils';

interface SoilBaselinePanelProps {
  test: SoilTestRecord | null | undefined;
}

const SECTION_KEYS = [
  { key: 'chemical', keys: ['ph', 'ec', 'organicCarbon', 'organicMatter', 'calciumCarbonate'] },
  { key: 'major', keys: ['nitrogen', 'phosphorus', 'potassium'] },
  { key: 'secondary', keys: ['calcium', 'magnesium', 'sulfur'] },
  { key: 'micro', keys: ['iron', 'manganese', 'zinc', 'copper', 'boron', 'molybdenum'] },
] as const;

export function SoilBaselinePanel({ test }: SoilBaselinePanelProps) {
  const { t } = useTranslation();
  const m3 = useM3();

  const params = useMemo(() => test?.parameters ?? {}, [test]);

  if (!test) {
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
        <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
          {formatDate(test.date, { year: 'numeric', month: 'short', day: 'numeric' })}
        </Text>
      </View>

      <View style={{ padding: spacing[3], gap: spacing[4] }}>
        {SECTION_KEYS.map((section) => {
          const entries = section.keys
            .map((key) => {
              const option = soilParamOptions.find((p) => p.key === key);
              const value = option ? lookupParam(params, key) : undefined;
              return { key, option, value };
            })
            .filter((item) => item.value !== undefined && item.value !== null);

          if (entries.length === 0) return null;

          return (
            <View key={section.key}>
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.semibold,
                  color: m3.colorScheme.onSurfaceVariant,
                  marginBottom: spacing[2],
                  textTransform: 'uppercase',
                }}
              >
                {t(`professional.reviews.soilSections.${section.key}`)}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                {entries.map(({ key, option, value }) => {
                  const status = option ? getParamStatus(value, option) : 'ok';
                  return (
                    <View
                      key={key}
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
                        {option?.shortLabel ?? key}
                        {option?.unit ? ` (${option.unit})` : ''}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.base,
                          fontWeight: fontWeight.semibold,
                          color: statusColor(status, m3.colorScheme),
                          marginTop: spacing[1],
                        }}
                      >
                        {formatSoilValue(value)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Soil options use camelCase keys (e.g. `organicCarbon`), but a stored record may
// key the same parameter as snake_case (`organic_carbon`) or lowercase. Match on a
// normalized form (alphanumerics only, lowercased) so values aren't silently dropped.
function lookupParam(params: Record<string, number>, key: string): number | undefined {
  if (params[key] !== undefined) return params[key];
  const normalize = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = normalize(key);
  for (const candidate of Object.keys(params)) {
    if (normalize(candidate) === target) return params[candidate];
  }
  return undefined;
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
