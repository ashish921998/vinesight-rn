import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';
import { Spinner } from '@/components/ui/spinner';
import { Symbol } from '@/components/ui/symbol';
import { fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import type { ViewStyle } from 'react-native';

interface ReportExporterCardProps {
  isExporting: boolean;
  onShare: () => void;
  panelStyle: ViewStyle;
}

export function ReportExporterCard({ isExporting, onShare, panelStyle }: ReportExporterCardProps) {
  const m3 = useM3();
  const { t } = useTranslation();

  return (
    <Animated.View
      entering={FadeInUp.duration(320).delay(150)}
      layout={Layout.springify().dampingRatio(1)}
      style={[
        panelStyle,
        {
          backgroundColor: m3.colorScheme.surfaceVariant,
          borderRadius: radius.xl,
          borderCurve: 'continuous',
          padding: spacing[4],
          gap: spacing[3],
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.lg,
            borderCurve: 'continuous',
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Symbol name="building.2.fill" size={20} color={m3.colorScheme.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.primary,
            }}
          >
            {t('reports.fpc.audience')}
          </Text>
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurface,
            }}
          >
            {t('reports.fpc.exportTitle')}
          </Text>
          <Text
            style={{
              fontSize: fontSize.sm,
              color: m3.colorScheme.onSurfaceVariant,
            }}
          >
            {t('reports.fpc.exportDescription')}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onShare}
        disabled={isExporting}
        accessibilityRole="button"
        accessibilityState={{ disabled: isExporting }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing[2],
          minHeight: 48,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          backgroundColor: pressed
            ? colorWithOpacity(m3.colorScheme.primary, 0.85)
            : m3.colorScheme.primary,
          opacity: isExporting ? 0.55 : 1,
        })}
      >
        {isExporting ? (
          <Spinner size="small" color={m3.colorScheme.onPrimary} />
        ) : (
          <>
            <Symbol name="square.and.arrow.up" size={18} color={m3.colorScheme.onPrimary} />
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.onPrimary,
              }}
            >
              {t('reports.fpc.shareXlsx')}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
