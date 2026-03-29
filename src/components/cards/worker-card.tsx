/**
 * WorkerCard Component
 * Displays a single worker with avatar, rate, and advance balance
 * Cellar Ledger design: 44px circular avatar, status dot, call button
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Symbol as CardSymbol } from '@/components/ui/symbol';
import type { Worker } from '../../types';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { formatCurrency } from '@/i18n/format';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '@/hooks/use-currency';
import { useM3, useThemeColors, useIsDark } from '@/styles/use-theme';

interface WorkerCardProps {
  worker: Worker;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function WorkerCard({ worker, onPress, onEdit, onDelete }: WorkerCardProps) {
  const m3 = useM3();
  const colors = useThemeColors();
  const isDark = useIsDark();
  const { t } = useTranslation();
  const preferredCurrency = useCurrency();

  // Labour category color for avatar (#7A5E8E light, #9A7EAE dark)
  const labourColor = isDark ? '#9A7EAE' : '#7A5E8E';

  const initial = worker.name.charAt(0).toUpperCase();
  const formattedRate = formatCurrency(worker.daily_rate, preferredCurrency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const formattedAdvance = formatCurrency(worker.advance_balance, preferredCurrency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  // Cellar Ledger: Card mist-1 bg, stone-3 border, 16px radius
  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface[100], // mist-1
    borderRadius: borderRadius.lg, // 16px
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderWidth: 1,
    borderColor: colors.surface[300], // stone-3
    overflow: 'hidden',
  };

  // Cellar Ledger: 44px circular avatar with labour color bg, white initials
  const avatarStyle: ViewStyle = {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: borderRadius.full,
    backgroundColor: labourColor,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  };

  const avatarTextStyle: TextStyle = {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: '#FFFFFF', // white initials
  };

  const infoContainerStyle: ViewStyle = {
    flex: 1,
  };

  // Cellar Ledger: Farm name bold 15px - using name for worker
  const nameTextStyle: TextStyle = {
    fontSize: 15, // 15px
    fontWeight: fontWeight.semibold, // bold
    color: colors.surface[900], // ink
  };

  const rateContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
  };

  // Cellar Ledger: secondary text 12px/bark
  const rateTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: colors.surface[500], // bark
    marginLeft: spacing[1],
  };

  const dayTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    color: colors.surface[400], // stone-5
  };

  const advanceContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
  };

  const advanceTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.warning, // warning
    marginLeft: spacing[1],
  };

  // Cellar Ledger: status dot (7px)
  const statusDotStyle: ViewStyle = {
    width: 7,
    height: 7,
    borderRadius: borderRadius.full,
    backgroundColor: worker.advance_balance > 0 ? colors.warning : colors.success, // green for active/healthy, amber for advance due
    marginRight: spacing[2],
  };

  // Cellar Ledger: call button (36px, borderRadius 12, primary-tinted bg)
  const callButtonStyle: ViewStyle = {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md, // 12px
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colorWithOpacity(colors.primary[500], 0.12), // primary-tinted bg
  };

  const actionsContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing[3],
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

  const renderCardContent = (pressed: boolean) => (
    <View style={containerStyle}>
      <View style={avatarStyle}>
        <Text style={avatarTextStyle}>{initial}</Text>
      </View>

      <View style={infoContainerStyle}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Cellar Ledger: status dot (7px) */}
          <View style={statusDotStyle} />
          <Text style={nameTextStyle} numberOfLines={1}>
            {worker.name}
          </Text>
        </View>
        <View style={rateContainerStyle}>
          <CardSymbol
            name="dollarsign.circle"
            size={12}
            color={colors.surface[400]} // stone-5
          />
          <Text style={rateTextStyle} numberOfLines={1}>
            {formattedRate}
            <Text style={dayTextStyle}>{t('workers.ratePerDayShort')}</Text>
          </Text>
        </View>
      </View>

      {/* Cellar Ledger: call button (36px, borderRadius 12, primary-tinted bg) */}
      <Pressable
        style={({ pressed: callPressed }) => [
          callButtonStyle,
          callPressed ? { backgroundColor: colorWithOpacity(colors.primary[500], 0.24) } : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('workers.workerCard.callA11y', { name: worker.name })}
      >
        <CardSymbol name="phone.fill" size={16} color={colors.primary[500]} />
      </Pressable>

      {worker.advance_balance > 0 && (
        <View style={[advanceContainerStyle, { marginLeft: spacing[2] }]}>
          <CardSymbol name="arrow.up.circle.fill" size={12} color={colors.warning} />
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
