/**
 * FarmCard Component
 * Card showing farm info with status, water balance, region
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
  const statusColor = needsAttention ? m3.colorScheme.error : m3.colorScheme.primary;
  const statusBg = needsAttention
    ? colorWithOpacity(m3.colorScheme.error, 0.12)
    : colorWithOpacity(m3.colorScheme.primary, 0.12);

  const cardStyle: ViewStyle = {
    borderRadius: m3.shape.cornerLarge,
    padding: spacing[4],
    backgroundColor: m3.surface.surfaceContainerLow,
    borderWidth: 1,
    borderColor: m3.colorScheme.outlineVariant,
    overflow: 'hidden',
  };

  const headerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  };

  const nameStyle: TextStyle = {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    flex: 1,
    marginRight: spacing[2],
    color: m3.colorScheme.onSurface,
    numberOfLines: 1,
  } as TextStyle;

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
                { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12) },
                actionPressed
                  ? {
                      backgroundColor: colorWithOpacity(
                        m3.colorScheme.primary,
                        0.12 + m3.stateLayerOpacity.pressed,
                      ),
                    }
                  : null,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('farmCard.a11y.editFarm', { name: farm.name })}
            >
              <UiSymbol name="pencil" size={18} color={m3.colorScheme.primary} />
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
                { backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.12) },
                actionPressed
                  ? {
                      backgroundColor: colorWithOpacity(
                        m3.colorScheme.error,
                        0.12 + m3.stateLayerOpacity.pressed,
                      ),
                    }
                  : null,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('farmCard.a11y.deleteFarm', { name: farm.name })}
            >
              <UiSymbol name="trash" size={18} color={m3.colorScheme.error} />
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
        {farm.crop_variety ? (
          <View
            style={{
              paddingHorizontal: spacing[2],
              paddingVertical: spacing[1],
              borderRadius: borderRadius.md,
              backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
            }}
          >
            <Text
              style={{
                ...m3.typography.labelSmall,
                fontWeight: fontWeight.bold,
                textTransform: 'uppercase',
                color: m3.colorScheme.primary,
              }}
              numberOfLines={1}
            >
              {farm.crop_variety}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <Text
          style={{
            fontSize: fontSize.sm,
            color: m3.colorScheme.onSurfaceVariant,
          }}
        >
          {farm.area != null
            ? t('farmCard.area.acres', {
                value: formatNumber(farm.area, { maximumFractionDigits: 1 }),
              })
            : t('farmCard.area.unknownAcres')}
        </Text>
      </View>

      {/* Data Grid */}
      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        {/* Water Balance Box */}
        <View
          style={{
            flex: 1,
            borderRadius: m3.shape.cornerMedium,
            padding: spacing[3],
            backgroundColor: m3.surface.surfaceContainerHigh,
            borderWidth: 1,
            borderColor: m3.colorScheme.outlineVariant,
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
                  ...m3.typography.labelSmall,
                  fontWeight: fontWeight.bold,
                  textTransform: 'uppercase',
                  color: m3.colorScheme.onSurfaceVariant,
                }}
                numberOfLines={1}
              >
                {t('farmCard.waterBalance.label')}
              </Text>
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: m3.colorScheme.onSurface,
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
            borderRadius: m3.shape.cornerMedium,
            padding: spacing[3],
            backgroundColor: m3.surface.surfaceContainerHigh,
            borderWidth: 1,
            borderColor: m3.colorScheme.outlineVariant,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <UiSymbol
              name="location.fill"
              size={12}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
            />
            <View>
              <Text
                style={{
                  ...m3.typography.labelSmall,
                  fontWeight: fontWeight.bold,
                  textTransform: 'uppercase',
                  color: m3.colorScheme.onSurfaceVariant,
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
