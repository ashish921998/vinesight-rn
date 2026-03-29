/**
 * FarmCard Component
 * Card showing farm info with status, water balance, region
 * Cellar Ledger design: mist-1 bg, stone-3 border, farm name 15px bold
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  GestureResponderEvent,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import type { Farm } from '../../types';
import { isLowWater } from '../../types';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { formatNumber } from '@/i18n/format';
import { useM3, useThemeColors } from '@/styles/use-theme';

interface FarmCardProps {
  farm: Farm;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function FarmCard({ farm, onPress, onEdit, onDelete }: FarmCardProps) {
  const m3 = useM3();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const needsAttention = isLowWater(farm);
  const statusText = needsAttention
    ? t('farmCard.status.needsAttention')
    : t('farmCard.status.healthy');
  // Cellar Ledger colors
  const statusColor = needsAttention ? colors.error : colors.primary[500];
  const statusBg = needsAttention
    ? colorWithOpacity(colors.error, 0.12)
    : colorWithOpacity(colors.primary[500], 0.12);

  // Cellar Ledger: mist-1 bg, stone-3 border, 16px radius
  // Note: 3px left strip applied via absolute positioned View with primary color
  const cardStyle: ViewStyle = {
    borderRadius: borderRadius.lg, // 16px
    padding: spacing[4],
    paddingLeft: spacing[4] + 3, // extra padding for left strip
    backgroundColor: colors.surface[100], // mist-1
    borderWidth: 1,
    borderColor: colors.surface[300], // stone-3
    overflow: 'hidden',
  };

  const headerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  };

  // Cellar Ledger: Farm name bold 15px
  const nameStyle: TextStyle = {
    fontSize: 15, // explicit 15px
    fontWeight: fontWeight.semibold, // bold (600)
    flex: 1,
    marginRight: spacing[2],
    color: colors.surface[900], // ink
  };

  const actionsStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  };

  const actionButtonStyle: ViewStyle = {
    width: 32,
    height: 32,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  const statusBadgeStyle: ViewStyle = {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    backgroundColor: statusBg,
  };

  const statusTextStyle: TextStyle = {
    ...m3.typography.labelSmall,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    color: statusColor,
  };

  const renderCardContent = (pressed: boolean) => (
    <View style={cardStyle}>
      {/* Cellar Ledger: 3px left green strip */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: colors.primary[500],
          borderTopLeftRadius: borderRadius.lg,
          borderBottomLeftRadius: borderRadius.lg,
        }}
      />
      {/* Header: Name & Status */}
      <View style={headerStyle}>
        <Text style={nameStyle} numberOfLines={1}>
          {farm.name}
        </Text>
        <View style={actionsStyle}>
          {onEdit && (
            <Pressable
              onPress={(e: GestureResponderEvent) => {
                e.stopPropagation();
                onEdit();
              }}
              style={({ pressed: actionPressed }) => [
                actionButtonStyle,
                { backgroundColor: colorWithOpacity(colors.primary[500], 0.12) },
                actionPressed
                  ? {
                      backgroundColor: colorWithOpacity(colors.primary[500], 0.24),
                    }
                  : null,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('farmCard.a11y.editFarm', { name: farm.name })}
            >
              <UiSymbol name="pencil" size={18} color={colors.primary[500]} />
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              onPress={(e: GestureResponderEvent) => {
                e.stopPropagation();
                onDelete();
              }}
              style={({ pressed: actionPressed }) => [
                actionButtonStyle,
                { backgroundColor: colorWithOpacity(colors.error, 0.12) },
                actionPressed
                  ? {
                      backgroundColor: colorWithOpacity(colors.error, 0.24),
                    }
                  : null,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('farmCard.a11y.deleteFarm', { name: farm.name })}
            >
              <UiSymbol name="trash" size={18} color={colors.error} />
            </Pressable>
          )}
          <View style={statusBadgeStyle}>
            <Text style={statusTextStyle}>{statusText}</Text>
          </View>
        </View>
      </View>

      {/* Subheader: Variety & Area */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing[4],
        }}
      >
        {/* Cellar Ledger: variety 13px muted (bark color) */}
        {farm.crop_variety ? (
          <Text
            style={{
              fontSize: 13, // 13px
              color: colors.surface[500], // bark
            }}
            numberOfLines={1}
          >
            {farm.crop_variety}
          </Text>
        ) : (
          <View />
        )}
        {/* Cellar Ledger: area badge pill with chevron right */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <View
            style={{
              paddingHorizontal: spacing[2],
              paddingVertical: spacing[1],
              borderRadius: borderRadius.full, // pill (999)
              backgroundColor: colorWithOpacity(colors.primary[500], 0.08), // rgba(53,88,71,0.08) per wireframe
            }}
          >
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                color: colors.primary[500],
              }}
              numberOfLines={1}
            >
              {farm.area != null
                ? t('farmCard.area.acres', {
                    value: formatNumber(farm.area, { maximumFractionDigits: 1 }),
                  })
                : t('farmCard.area.unknownAcres')}
            </Text>
          </View>
          <UiSymbol
            name="chevron.right"
            size={16}
            color={colors.surface[400]} // stone-5
          />
        </View>
      </View>

      {/* Data Grid */}
      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        {/* Water Balance Box */}
        <View
          style={{
            flex: 1,
            borderRadius: borderRadius.md,
            padding: spacing[3],
            backgroundColor: colors.surface[200], // mist-2
            borderWidth: 1,
            borderColor: colors.surface[300], // stone-3
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <View
              style={{
                width: 12,
                height: 12,
                minWidth: 12,
                minHeight: 12,
                borderRadius: borderRadius.full,
                backgroundColor: colors.harvest[500],
              }}
            />
            <View>
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.semibold,
                  textTransform: 'uppercase',
                  color: colors.surface[500], // bark
                }}
                numberOfLines={1}
              >
                {t('farmCard.waterBalance.label')}
              </Text>
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[900], // ink
                }}
              >
                {farm.remaining_water != null
                  ? t('farmCard.waterBalance.value', {
                      value: formatNumber(farm.remaining_water, { maximumFractionDigits: 1 }),
                    })
                  : t('farmCard.waterBalance.unknown')}
              </Text>
            </View>
          </View>
        </View>

        {/* Region Box */}
        <View
          style={{
            flex: 1,
            borderRadius: borderRadius.md,
            padding: spacing[3],
            backgroundColor: colors.surface[200], // mist-2
            borderWidth: 1,
            borderColor: colors.surface[300], // stone-3
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <UiSymbol
              name="location.fill"
              size={12}
              color={colorWithOpacity(colors.surface[500], 0.7)} // bark
            />
            <View>
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.semibold,
                  textTransform: 'uppercase',
                  color: colors.surface[500], // bark
                }}
                numberOfLines={1}
              >
                {t('farmCard.region.label')}
              </Text>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: m3.colorScheme.onSurface,
                }}
                numberOfLines={1}
              >
                {farm.region || t('farmCard.region.unknown')}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: pressed
              ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
              : 'transparent',
          },
        ]}
      />
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={farm.name}>
        {({ pressed }) => renderCardContent(pressed)}
      </Pressable>
    );
  }

  return renderCardContent(false);
}
