import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeScreen } from '@/components/ui/safe-screen';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { Button } from '@/components/ui/button';
import { m3, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { telemetry } from '@/services/telemetry';

interface LockedFeatureScreenProps {
  title: string;
  description: string;
  ctaLabel: string;
  featureKey: string;
  onUpgrade?: () => void;
  onClose?: () => void;
  secondaryLabel?: string;
}

export function LockedFeatureScreen({
  title,
  description,
  ctaLabel,
  featureKey,
  onUpgrade,
  onClose,
  secondaryLabel = 'Go back',
}: LockedFeatureScreenProps) {
  const router = useRouter();

  useEffect(() => {
    telemetry.capture('feature_locked_viewed', {
      feature_key: featureKey,
    });
  }, [featureKey]);

  const handleUpgrade = () => {
    telemetry.capture('upgrade_clicked', {
      source: 'locked_screen',
      feature_key: featureKey,
    });
    onUpgrade?.();
  };

  return (
    <SafeScreen backgroundColor={m3.colorScheme.surface}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing[6],
        }}
      >
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: borderRadius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: m3.colorScheme.primaryContainer,
            marginBottom: spacing[6],
          }}
        >
          <UiSymbol name="lock.fill" size={40} color={m3.colorScheme.primary} />
        </View>
        <Text
          style={{
            fontSize: fontSize['2xl'],
            fontWeight: fontWeight.bold,
            color: m3.colorScheme.onSurface,
            textAlign: 'center',
            marginBottom: spacing[2],
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: fontSize.base,
            color: m3.colorScheme.onSurfaceVariant,
            textAlign: 'center',
            marginBottom: spacing[6],
          }}
        >
          {description}
        </Text>
        <View style={{ width: '100%', maxWidth: 360 }}>
          <Button title={ctaLabel} onPress={handleUpgrade} />
        </View>
        <View style={{ width: '100%', maxWidth: 360, marginTop: spacing[3] }}>
          <Button
            title={secondaryLabel}
            variant="ghost"
            onPress={() => {
              onClose?.();
              router.back();
            }}
          />
        </View>
      </View>
    </SafeScreen>
  );
}
