import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as Icon } from '@/components/ui/symbol';
import { Spinner } from '@/components/ui/spinner';
import { spacing, fontSize, fontWeight, radius } from '@/styles/theme';
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
          backgroundColor: m3.colorScheme.surface,
          borderWidth: 1,
          borderColor: m3.colorScheme.outlineVariant,
          borderRadius: radius.xl,
          borderCurve: 'continuous',
          paddingTop: spacing[2],
          paddingBottom: spacing[3],
          paddingHorizontal: spacing[3],
          gap: spacing[2],
        },
        panelStyle,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing[2],
        }}
      >
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
                  minWidth: 46,
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

        <Pressable
          onPress={onExportPdf}
          disabled={disabled}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing[2],
            minHeight: 46,
            borderRadius: radius.lg,
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
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: disabled ? colorWithOpacity(onPrimary, 0.6) : onPrimary,
                }}
              >
                {t('reports.share')}
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={onDownload}
          disabled={disabled}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing[2],
            minHeight: 46,
            paddingHorizontal: spacing[3],
            borderRadius: radius.lg,
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
                numberOfLines={1}
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
