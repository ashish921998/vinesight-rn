/**
 * WorkerCard Component
 * Displays a single worker with avatar, rate, and advance balance
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Symbol as CardSymbol } from '@/components/ui/symbol';
import type { Worker } from '../../types';
import { m3, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { formatCurrency } from '@/i18n/format';
import { useTranslation } from 'react-i18next';

interface WorkerCardProps {
  worker: Worker;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function WorkerCard({ worker, onPress, onEdit, onDelete }: WorkerCardProps) {
  const { t } = useTranslation();

  const initial = worker.name.charAt(0).toUpperCase();
  const formattedRate = formatCurrency(worker.daily_rate, 'INR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const formattedAdvance = formatCurrency(worker.advance_balance, 'INR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: m3.surface.surfaceContainerLow,
    borderRadius: m3.shape.cornerLarge,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderWidth: 1,
    borderColor: m3.colorScheme.outlineVariant,
    overflow: 'hidden',
  };

  const avatarStyle: ViewStyle = {
    width: 48,
    height: 48,
    minWidth: 48,
    minHeight: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.18),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  };

  const avatarTextStyle: TextStyle = {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: m3.colorScheme.primary,
  };

  const infoContainerStyle: ViewStyle = {
    flex: 1,
  };

  const nameTextStyle: TextStyle = {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: m3.colorScheme.onSurface,
  };

  const rateContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
  };

  const rateTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: m3.colorScheme.onSurfaceVariant,
    marginLeft: spacing[1],
  };

  const dayTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7),
  };

  const advanceContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
  };

  const advanceTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: m3.colorScheme.warning,
    marginLeft: spacing[1],
  };

  const actionsContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing[3],
    gap: spacing[2],
  };

  const actionButtonStyle: ViewStyle = {
    padding: spacing[2],
    borderRadius: m3.shape.cornerMedium,
    overflow: 'hidden',
  };

  const renderCardContent = (pressed: boolean) => (
    <View style={containerStyle}>
      <View style={avatarStyle}>
        <Text style={avatarTextStyle}>{initial}</Text>
      </View>

      <View style={infoContainerStyle}>
        <Text style={nameTextStyle} numberOfLines={1}>
          {worker.name}
        </Text>
        <View style={rateContainerStyle}>
          <CardSymbol
            name="dollarsign.circle"
            size={12}
            color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.8)}
          />
          <Text style={rateTextStyle} numberOfLines={1}>
            {formattedRate}
            <Text style={dayTextStyle}>{t('workers.ratePerDayShort')}</Text>
          </Text>
        </View>
      </View>

      {worker.advance_balance > 0 && (
        <View style={advanceContainerStyle}>
          <CardSymbol name="arrow.up.circle.fill" size={12} color={m3.colorScheme.warning} />
          <Text style={advanceTextStyle}>{formattedAdvance}</Text>
        </View>
      )}

      {(onEdit || onDelete) && (
        <View style={actionsContainerStyle}>
          {onEdit && (
            <Pressable
              onPress={onEdit}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('workers.workerCard.editA11y', { name: worker.name })}
              style={({ pressed: actionPressed }) => [
                actionButtonStyle,
                actionPressed
                  ? {
                      backgroundColor: colorWithOpacity(
                        m3.colorScheme.onSurface,
                        m3.stateLayerOpacity.pressed,
                      ),
                    }
                  : null,
              ]}
            >
              <CardSymbol name="pencil" size={18} color={m3.colorScheme.primary} />
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              onPress={onDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('workers.workerCard.deleteA11y', { name: worker.name })}
              style={({ pressed: actionPressed }) => [
                actionButtonStyle,
                actionPressed
                  ? {
                      backgroundColor: colorWithOpacity(
                        m3.colorScheme.onSurface,
                        m3.stateLayerOpacity.pressed,
                      ),
                    }
                  : null,
              ]}
            >
              <CardSymbol name="trash" size={18} color={m3.colorScheme.error} />
            </Pressable>
          )}
        </View>
      )}

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
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={worker.name}>
        {({ pressed }) => renderCardContent(pressed)}
      </Pressable>
    );
  }

  return renderCardContent(false);
}
