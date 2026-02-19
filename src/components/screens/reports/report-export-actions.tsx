import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as Icon } from '@/components/ui/symbol';
import { spacing, fontSize, fontWeight, borderRadius, shadows } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

interface ReportExportActionsProps {
  canExport: boolean;
  isExporting: boolean;
  onExportPdf: () => void;
  onDownload: () => void;
  panelStyle: object;
}

export function ReportExportActions({
  canExport,
  isExporting,
  onExportPdf,
  onDownload,
  panelStyle,
}: ReportExportActionsProps) {
  const m3 = useM3();
  const { t } = useTranslation();

  const disabled = !canExport || isExporting;
  const primary = m3.colorScheme.primary;
  const onPrimary = m3.colorScheme.onPrimary;

  return (
    <View
      style={[
        {
          backgroundColor: colorWithOpacity(m3.colorScheme.surface, 0.88),
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: m3.colorScheme.outlineVariant,
          paddingTop: spacing[3],
          paddingBottom: spacing[6],
          paddingHorizontal: spacing[4],
          gap: spacing[2],
        },
        shadows.md,
        panelStyle,
      ]}
    >
      {/* Section label */}
      <Text
        style={{
          fontSize: fontSize.xs,
          fontWeight: fontWeight.medium,
          color: m3.colorScheme.onSurfaceVariant,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: spacing[1],
        }}
      >
        {t('reports.exportAs', 'Export Report')}
      </Text>

      {/* Button row */}
      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        {/* PDF — Primary filled button */}
        <Pressable
          onPress={onExportPdf}
          disabled={disabled}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing[2],
            minHeight: 50,
            borderRadius: borderRadius.xl,
            borderCurve: 'continuous',
            backgroundColor: disabled
              ? colorWithOpacity(primary, 0.38)
              : pressed
                ? colorWithOpacity(primary, 0.85)
                : primary,
            ...shadows.sm,
          })}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={onPrimary} />
          ) : (
            <>
              <Icon
                name="doc.fill"
                size={18}
                color={disabled ? colorWithOpacity(onPrimary, 0.6) : onPrimary}
              />
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: disabled ? colorWithOpacity(onPrimary, 0.6) : onPrimary,
                }}
              >
                Export PDF
              </Text>
            </>
          )}
        </Pressable>

        {/* Download — Secondary outlined button */}
        <Pressable
          onPress={onDownload}
          disabled={disabled}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing[2],
            minHeight: 50,
            borderRadius: borderRadius.xl,
            borderCurve: 'continuous',
            borderWidth: 1.5,
            borderColor: disabled ? colorWithOpacity(primary, 0.3) : primary,
            backgroundColor: pressed
              ? colorWithOpacity(primary, 0.08)
              : m3.colorScheme.surfaceVariant,
            opacity: disabled ? 0.55 : 1,
          })}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={primary} />
          ) : (
            <>
              <Icon
                name="arrow.down.circle.fill"
                size={18}
                color={disabled ? colorWithOpacity(primary, 0.5) : primary}
              />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: disabled ? colorWithOpacity(primary, 0.5) : primary,
                }}
              >
                {t('reports.downloadReport')}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
