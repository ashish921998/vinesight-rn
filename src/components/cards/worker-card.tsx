/**
 * WorkerCard Component
 * Displays a single worker with avatar, rate, and advance balance
 */

import React from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Symbol as CardSymbol } from '@/components/ui/symbol';
import type { Worker } from '../../types';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

interface WorkerCardProps {
  worker: Worker;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function WorkerCard({ worker, onPress, onEdit, onDelete }: WorkerCardProps) {
  const initial = worker.name.charAt(0).toUpperCase();
  const formattedRate = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(worker.daily_rate);
  const formattedAdvance = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(worker.advance_balance);

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface[50],
    borderRadius: borderRadius['2xl'],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  };

  const avatarStyle: ViewStyle = {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: `${colors.primary[500]}33`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  };

  const avatarTextStyle: TextStyle = {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
  };

  const infoContainerStyle: ViewStyle = {
    flex: 1,
  };

  const nameTextStyle: TextStyle = {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.surface[900],
  };

  const rateContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
  };

  const rateTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    color: colors.surface[600],
    marginLeft: spacing[1],
  };

  const dayTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    color: colors.surface[400],
  };

  const advanceContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
  };

  const advanceTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#F59E0B',
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
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [containerStyle, { opacity: pressed ? 0.8 : 1 }]}
    >
      {/* Avatar */}
      <View style={avatarStyle}>
        <Text style={avatarTextStyle}>{initial}</Text>
      </View>

      {/* Info */}
      <View style={infoContainerStyle}>
        <Text style={nameTextStyle}>{worker.name}</Text>
        <View style={rateContainerStyle}>
          <CardSymbol name="dollarsign.circle" size={12} color={colors.surface[600]} />
          <Text style={rateTextStyle}>
            {formattedRate}
            <Text style={dayTextStyle}> /day</Text>
          </Text>
        </View>
      </View>

      {/* Advance Balance (if any) */}
      {worker.advance_balance > 0 && (
        <View style={advanceContainerStyle}>
          <CardSymbol name="arrow.up.circle.fill" size={12} color="#F59E0B" />
          <Text style={advanceTextStyle}>{formattedAdvance}</Text>
        </View>
      )}

      {/* Actions */}
      {(onEdit || onDelete) && (
        <View style={actionsContainerStyle}>
          {onEdit && (
            <Pressable
              onPress={onEdit}
              style={({ pressed }) => [actionButtonStyle, { opacity: pressed ? 0.6 : 1 }]}
            >
              <CardSymbol name="pencil" size={18} color="#3B82F6" />
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              onPress={onDelete}
              style={({ pressed }) => [actionButtonStyle, { opacity: pressed ? 0.6 : 1 }]}
            >
              <CardSymbol name="trash" size={18} color="#EF4444" />
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}
