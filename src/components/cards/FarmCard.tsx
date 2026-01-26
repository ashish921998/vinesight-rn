/**
 * FarmCard Component
 * Card showing farm info with status, water balance, region
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  GestureResponderEvent,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Symbol } from '@/components/ui/Symbol';
import type { Farm } from '../../types';
import { isLowWater } from '../../types';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

interface FarmCardProps {
  farm: Farm;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function FarmCard({ farm, onPress, onEdit, onDelete }: FarmCardProps) {
  const needsAttention = isLowWater(farm);
  const statusText = needsAttention ? 'NEEDS ATTENTION' : 'HEALTHY';
  const statusColor = needsAttention ? colors.error : colors.primary;
  const statusBg = needsAttention ? 'rgba(255, 59, 48, 0.1)' : 'rgba(64, 128, 89, 0.1)';

  const cardStyle: ViewStyle = {
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    backgroundColor: colors.white,
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
    color: colors.black,
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
  };

  const statusBadgeStyle: ViewStyle = {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    backgroundColor: statusBg,
  };

  const statusTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    color: statusColor,
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.9 : 1 }]}
    >
      {/* Header: Name & Status */}
      <View style={headerStyle}>
        <Text style={nameStyle}>{farm.name}</Text>
        <View style={actionsStyle}>
          {onEdit && (
            <TouchableOpacity
              onPress={(e: GestureResponderEvent) => {
                e.stopPropagation();
                onEdit();
              }}
              style={[actionButtonStyle, { backgroundColor: 'rgba(64, 128, 89, 0.1)' }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Symbol name="pencil" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              onPress={(e: GestureResponderEvent) => {
                e.stopPropagation();
                onDelete();
              }}
              style={[actionButtonStyle, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Symbol name="trash" size={18} color={colors.error} />
            </TouchableOpacity>
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
              backgroundColor: 'rgba(64, 128, 89, 0.1)',
            }}
          >
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                textTransform: 'uppercase',
                color: colors.primary,
              }}
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
            color: colors.gray[400],
          }}
        >
          {farm.area.toFixed(1)} Acres
        </Text>
      </View>

      {/* Data Grid */}
      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        {/* Water Balance Box */}
        <View
          style={{
            flex: 1,
            borderRadius: borderRadius.xl,
            padding: spacing[3],
            backgroundColor: colors.gray[100],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: borderRadius.full,
                backgroundColor: '#669475',
              }}
            />
            <View>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: fontWeight.bold,
                  textTransform: 'uppercase',
                  color: colors.gray[400],
                }}
              >
                WATER BALANCE
              </Text>
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: colors.black,
                }}
              >
                {farm.remaining_water != null ? `${farm.remaining_water.toFixed(1)} mm` : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Region Box */}
        <View
          style={{
            flex: 1,
            borderRadius: borderRadius.xl,
            padding: spacing[3],
            backgroundColor: colors.gray[100],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <Symbol name="location.fill" size={12} color={colors.gray[400]} />
            <View>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: fontWeight.bold,
                  textTransform: 'uppercase',
                  color: colors.gray[400],
                }}
              >
                REGION
              </Text>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: colors.black,
                }}
                numberOfLines={1}
              >
                {farm.region || 'Unknown'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
