import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Button } from '@/components/ui/button';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { m3, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { telemetry } from '@/services/telemetry';

interface FeatureLockCardProps {
  title: string;
  description: string;
  ctaLabel: string;
  featureKey: string;
  onUpgrade?: () => void;
}

export function FeatureLockCard({
  title,
  description,
  ctaLabel,
  featureKey,
  onUpgrade,
}: FeatureLockCardProps) {
  useEffect(() => {
    telemetry.capture('feature_locked_viewed', {
      feature_key: featureKey,
      source: 'card',
    });
  }, [featureKey]);

  const handleUpgrade = () => {
    telemetry.capture('upgrade_clicked', {
      source: 'feature_card',
      feature_key: featureKey,
    });
    onUpgrade?.();
  };

  return (
    <View
      style={{
        borderRadius: borderRadius.xl,
        padding: spacing[4],
        backgroundColor: m3.surface.surfaceContainer,
        borderWidth: 1,
        borderColor: m3.colorScheme.outlineVariant,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2] }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: borderRadius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: m3.colorScheme.primaryContainer,
            marginRight: spacing[3],
          }}
        >
          <UiSymbol name="lock.fill" size={18} color={m3.colorScheme.primary} />
        </View>
        <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>{title}</Text>
      </View>
      <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginBottom: spacing[4] }}>
        {description}
      </Text>
      <Button title={ctaLabel} onPress={handleUpgrade} />
    </View>
  );
}
