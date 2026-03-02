import React, { useCallback } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Symbol as AssistantSymbol } from '@/components/ui/symbol';
import { useFabBottomPosition } from '@/hooks/use-fab-bottom-position';
import { useM3 } from '@/styles/use-theme';
import { shadows } from '@/styles/theme';

const FAB_SIZE = 56;
const FAB_RIGHT = 20;

interface FloatingAssistantButtonProps {
  onPress: () => void;
  rightOffset?: number;
}

export function FloatingAssistantButton({
  onPress,
  rightOffset = 0,
}: FloatingAssistantButtonProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const bottomPosition = useFabBottomPosition();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  }, [onPress]);

  const dynamicStyle: ViewStyle = {
    bottom: bottomPosition,
    right: FAB_RIGHT + rightOffset,
    backgroundColor: m3.colorScheme.primary,
    ...shadows.lg,
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={t('ai.openAssistant')}
      style={({ pressed }) => [
        styles.fab,
        dynamicStyle,
        pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] },
      ]}
    >
      <AssistantSymbol name="lightbulb.fill" size={24} color={m3.colorScheme.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 8,
  },
});
