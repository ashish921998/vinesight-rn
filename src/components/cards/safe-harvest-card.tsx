import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { borderRadius, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

interface SafeHarvestCardProps {
  earliestDate: string | null | undefined;
  blockingReason?: string | null;
  targetHarvestDate: string | null | undefined;
  hasConflict: boolean;
  onSetTargetDate: () => void;
  onOpenChecker: () => void;
}

export function SafeHarvestCard({
  earliestDate,
  blockingReason,
  targetHarvestDate,
  hasConflict,
  onSetTargetDate,
  onOpenChecker,
}: SafeHarvestCardProps) {
  const { t } = useTranslation();
  const m3 = useM3();

  return (
    <View
      style={{
        borderRadius: m3.shape.cornerMedium,
        padding: spacing[3],
        backgroundColor: hasConflict
          ? colorWithOpacity(m3.colorScheme.error, 0.08)
          : m3.surface.surfaceContainerLow,
        borderWidth: 1,
        borderColor: hasConflict
          ? colorWithOpacity(m3.colorScheme.error, 0.3)
          : m3.colorScheme.outlineVariant,
      }}
      testID="safe-harvest-card"
    >
      <Text
        style={{
          color: m3.colorScheme.onSurfaceVariant,
          ...m3.typography.labelSmall,
          fontWeight: fontWeight.bold,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {t('farmDetails.safeHarvest.title')}
      </Text>

      {earliestDate ? (
        <>
          <Text
            style={{
              color: hasConflict ? m3.colorScheme.error : m3.colorScheme.primary,
              ...m3.typography.titleMedium,
              marginTop: spacing[1],
              fontWeight: fontWeight.bold,
            }}
          >
            {t('farmDetails.safeHarvest.safeDate', {
              date: earliestDate,
            })}
          </Text>
          {blockingReason ? (
            <Text
              style={{
                color: m3.colorScheme.onSurfaceVariant,
                ...m3.typography.labelSmall,
                marginTop: 4,
              }}
            >
              {t('farmDetails.safeHarvest.blockedBy', { reason: blockingReason })}
            </Text>
          ) : null}
        </>
      ) : (
        <Text
          style={{
            color: m3.colorScheme.onSurfaceVariant,
            ...m3.typography.labelSmall,
            marginTop: spacing[2],
          }}
        >
          {t('farmDetails.safeHarvest.noData')}
        </Text>
      )}

      <Text
        style={{
          color: m3.colorScheme.onSurfaceVariant,
          ...m3.typography.labelSmall,
          marginTop: spacing[1],
        }}
      >
        {targetHarvestDate ?? t('farmDetails.safeHarvest.noTarget')}
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] }}>
        <Pressable
          onPress={onSetTargetDate}
          style={{
            paddingHorizontal: spacing[2],
            paddingVertical: 6,
            borderRadius: borderRadius.full,
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.14),
          }}
        >
          <Text
            style={{
              color: m3.colorScheme.primary,
              ...m3.typography.labelSmall,
            }}
          >
            {t('farmDetails.safeHarvest.ctaSetTarget')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onOpenChecker}
          style={{
            paddingHorizontal: spacing[2],
            paddingVertical: 6,
            borderRadius: borderRadius.full,
            backgroundColor: colorWithOpacity(m3.colorScheme.secondary, 0.14),
          }}
        >
          <Text
            style={{
              color: m3.colorScheme.secondary,
              ...m3.typography.labelSmall,
            }}
          >
            {t('farmDetails.safeHarvest.ctaOpenChecker')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
