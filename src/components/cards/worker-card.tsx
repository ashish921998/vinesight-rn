/**
 * WorkerCard Component
 * Displays a single worker with avatar, role, farm, status, and call button
 * Cellar Ledger design: 44px circular avatar, status dot + label, call button
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Symbol as CardSymbol } from '@/components/ui/symbol';
import type { Worker } from '../../types';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';
import { useM3, useThemeColors, useIsDark } from '@/styles/use-theme';

interface WorkerCardProps {
  worker: Worker;
  onPress?: () => void;
  onCall?: (worker: Worker) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Whether the worker is currently active (for status display) */
  isActive?: boolean;
}

export function WorkerCard({
  worker,
  onPress,
  onCall,
  onEdit,
  onDelete,
  isActive = worker.is_active,
}: WorkerCardProps) {
  const m3 = useM3();
  const colors = useThemeColors();
  const isDark = useIsDark();
  const { t } = useTranslation();

  // Labour category color for avatar (#7A5E8E light, #9A7EAE dark)
  const labourColor = isDark ? '#9A7EAE' : '#7A5E8E';
  // Inactive workers use stone-5 for avatar
  const inactiveAvatarColor = isDark ? '#7A756D' : '#A89E92';

  const initials = worker.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Cellar Ledger: Card mist-1 bg, stone-3 border, 16px radius
  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface[100], // mist-1
    borderRadius: borderRadius.md, // 16px
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
    backgroundColor: isActive ? labourColor : inactiveAvatarColor,
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
    minWidth: 0,
  };

  // Cellar Ledger: Worker name 15px/600
  const nameTextStyle: TextStyle = {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    color: colors.surface[900], // ink
  };

  // Cellar Ledger: status dot (7px) + label (12px)
  const statusContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
    gap: spacing[2],
  };

  const statusDotStyle: ViewStyle = {
    width: 7,
    height: 7,
    borderRadius: borderRadius.full,
    backgroundColor: isActive ? colors.success : colors.surface[400], // green for active, stone-5 for inactive
  };

  const statusLabelStyle: TextStyle = {
    fontSize: 12,
    fontWeight: fontWeight.medium,
    lineHeight: 16,
    color: isActive ? colors.success : colors.surface[400], // green for active, stone-5 for inactive
  };

  // Cellar Ledger: call button (36px, borderRadius 12, primary-tinted bg)
  const callButtonStyle: ViewStyle = {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm, // 12px
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colorWithOpacity(colors.primary[500], 0.12), // primary-tinted bg
  };

  const actionsContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing[2],
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
      {/* 44px circular avatar */}
      <View style={avatarStyle}>
        <Text style={avatarTextStyle}>{initials}</Text>
      </View>

      {/* Info: name, role + farm, status dot + label */}
      <View style={infoContainerStyle}>
        <Text style={nameTextStyle} numberOfLines={1}>
          {worker.name}
        </Text>

        {/* Status dot + label */}
        <View style={statusContainerStyle}>
          <View style={statusDotStyle} />
          <Text style={statusLabelStyle}>
            {isActive ? t('workers.status.active') : t('workers.status.inactive')}
          </Text>
        </View>
      </View>

      {/* Call button (36px, 12px radius, primary-tinted bg) */}
      {onCall ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onCall(worker);
          }}
          style={({ pressed: callPressed }) => [
            callButtonStyle,
            callPressed ? { backgroundColor: colorWithOpacity(colors.primary[500], 0.24) } : null,
            !isActive ? { opacity: 0.5 } : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('workers.workerCard.callA11y', { name: worker.name })}
        >
          <CardSymbol name="phone.fill" size={16} color={colors.primary[500]} />
        </Pressable>
      ) : null}

      {(onEdit || onDelete) && (
        <View style={actionsContainerStyle}>
          {onEdit && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onEdit();
              }}
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
              onPress={(e) => {
                e.stopPropagation();
                onDelete();
              }}
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
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={worker.name}
        style={!isActive ? { opacity: 0.55 } : undefined}
      >
        {({ pressed }) => renderCardContent(pressed)}
      </Pressable>
    );
  }

  return renderCardContent(false);
}
