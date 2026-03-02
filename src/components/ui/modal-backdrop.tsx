import { BlurView } from 'expo-blur';
import React, { type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useIsDark, useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

export interface ModalBackdropProps {
  visible: boolean;
  onDismiss: () => void;
  children: ReactNode;
  alignment?: 'center' | 'flex-end';
  opacity?: number;
  zIndex?: number;
  enableBlur?: boolean;
  blurIntensity?: number;
}

/**
 * Full-screen modal overlay with shadow background and dismiss-on-tap.
 * Use for bottom sheets, pickers, and dialogs that need a dimmed backdrop.
 */
export function ModalBackdrop({
  visible,
  onDismiss,
  children,
  alignment = 'flex-end',
  opacity = 0.5,
  zIndex,
  enableBlur = true,
  blurIntensity = 20,
}: ModalBackdropProps) {
  const m3 = useM3();
  const isDark = useIsDark();

  if (!visible) return null;

  const overlayStyle = {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colorWithOpacity(m3.colorScheme.shadow, opacity),
    ...(zIndex !== undefined && { zIndex }),
  };

  const shouldBlur = enableBlur && Platform.OS !== 'web';

  return (
    <Pressable onPress={onDismiss} style={overlayStyle}>
      {shouldBlur ? (
        <BlurView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          intensity={blurIntensity}
          tint={isDark ? 'dark' : 'light'}
          {...(Platform.OS === 'android'
            ? { experimentalBlurMethod: 'dimezisBlurView' as const }
            : {})}
        />
      ) : null}
      <View style={{ flex: 1, justifyContent: alignment }} pointerEvents="box-none">
        {children}
      </View>
    </Pressable>
  );
}
