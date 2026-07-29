import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as Icon } from '@/components/ui/symbol';
import { Spinner } from '@/components/ui/spinner';
import { spacing, fontSize, fontWeight, borderRadius, radius } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import type { ReportFormat } from '@/types/report';

const EXPORT_FORMATS: ReportFormat[] = ['pdf', 'csv'];

/* Inset of the active segment inside the toggle track. */
const SEGMENT_INSET = 2;

interface ReportExportActionsProps {
  canExport: boolean;
  isExporting: boolean;
  exportFormat: ReportFormat;
  onSelectFormat: (format: ReportFormat) => void;
  onExportPdf: () => void;
  onDownload: () => void;
  panelStyle: object;
}

export function ReportExportActions({
  canExport,
  isExporting,
  exportFormat,
  onSelectFormat,
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
          // Opaque: content scrolls underneath, and without a real blur layer a
          // translucent bar just reads as muddy overlap.
          backgroundColor: m3.colorScheme.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: m3.colorScheme.outlineVariant,
          paddingTop: spacing[3],
          paddingBottom: spacing[6],
          paddingHorizontal: spacing[4],
          gap: spacing[3],
        },
        panelStyle,
      ]}
    >
      {/* Context label + format choice — the format lives next to the action it
          affects, so it isn't also duplicated up in the filters panel. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing[2],
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: fontSize.xs,
            fontWeight: fontWeight.medium,
            color: m3.colorScheme.onSurfaceVariant,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          {t('reports.exportSection')}
        </Text>

        <View
          accessibilityRole="radiogroup"
          style={{
            flexDirection: 'row',
            backgroundColor: m3.surface.s200,
            borderRadius: radius.sm,
            borderCurve: 'continuous',
            padding: SEGMENT_INSET,
          }}
        >
          {EXPORT_FORMATS.map((format) => {
            const active = exportFormat === format;
            return (
              <Pressable
                key={format}
                onPress={() => onSelectFormat(format)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={{
                  minWidth: 48,
                  paddingHorizontal: spacing[2],
                  paddingVertical: spacing[1],
                  alignItems: 'center',
                  borderRadius: radius.sm - SEGMENT_INSET,
                  borderCurve: 'continuous',
                  backgroundColor: active ? m3.surface.s100 : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.semibold,
                    color: active ? primary : m3.colorScheme.onSurfaceVariant,
                  }}
                >
                  {format.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

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
            borderWidth: 1,
            borderColor: colorWithOpacity(primary, 0.2),
          })}
        >
          {isExporting ? (
            <Spinner size="small" color={onPrimary} />
          ) : (
            <>
              <Icon
                name={exportFormat === 'csv' ? 'tablecells.fill' : 'doc.fill'}
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
                {t('reports.share')}
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
            <Spinner size="small" color={primary} />
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
                {t('reports.saveToFiles')}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
