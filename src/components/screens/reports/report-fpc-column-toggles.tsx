import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { Symbol } from '@/components/ui/symbol';
import { type FpcColumnOptions, FPC_OPTIONAL_COLUMN_KEYS } from '@/types/report';

interface ReportFpcColumnTogglesProps {
  columns: FpcColumnOptions;
  onChange: (columns: FpcColumnOptions) => void;
  panelStyle: object;
}

/**
 * Optional-column toggles for the FPC activity register. The register ships
 * lean by default (buyer-facing — Fratelli asked to drop irrigation/PHI/MRL and
 * make the technical name optional); each chip turns one column back on for
 * audit-facing exports. Date / Day / Stage / Market / Qty / Notes are the
 * always-on spine and have no toggle.
 */
export function ReportFpcColumnToggles({
  columns,
  onChange,
  panelStyle,
}: ReportFpcColumnTogglesProps) {
  const { t } = useTranslation();
  const m3 = useM3();

  return (
    <View style={[panelStyle, { gap: spacing[2] }]}>
      <Text
        style={{
          fontSize: fontSize.xs,
          color: m3.colorScheme.onSurfaceVariant,
          fontWeight: fontWeight.medium,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {t('reports.fpc.columns.title')}
      </Text>
      <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
        {t('reports.fpc.columns.hint')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[2], paddingRight: spacing[1] }}
      >
        {FPC_OPTIONAL_COLUMN_KEYS.map((key) => {
          const active = columns[key];
          return (
            <Pressable
              key={key}
              onPress={() => onChange({ ...columns, [key]: !active })}
              accessibilityRole="switch"
              accessibilityState={{ checked: active }}
              accessibilityLabel={t(`reports.fpc.columns.${key}`)}
              style={{
                minHeight: 34,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[1],
                borderRadius: borderRadius.full,
                borderCurve: 'continuous',
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[1],
                borderWidth: 1,
                borderColor: active
                  ? m3.colorScheme.primary
                  : colorWithOpacity(m3.colorScheme.primary, 0.3),
                backgroundColor: active
                  ? m3.colorScheme.primary
                  : colorWithOpacity(m3.colorScheme.primary, 0.06),
              }}
            >
              <Symbol
                name={active ? 'checkmark' : 'plus'}
                size={12}
                color={active ? m3.colorScheme.onPrimary : m3.colorScheme.primary}
              />
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.medium,
                  color: active ? m3.colorScheme.onPrimary : m3.colorScheme.primary,
                }}
              >
                {t(`reports.fpc.columns.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
