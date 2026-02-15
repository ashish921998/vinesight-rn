import React, { type ReactNode } from 'react';
import { Pressable } from 'react-native';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

export interface ModalBackdropProps {
  visible: boolean;
  onDismiss: () => void;
  children: ReactNode;
  alignment?: 'center' | 'flex-end';
  opacity?: number;
  zIndex?: number;
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
}: ModalBackdropProps) {
  const m3 = useM3();

  if (!visible) return null;

  const overlayStyle = {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colorWithOpacity(m3.colorScheme.shadow, opacity),
    justifyContent: alignment,
    ...(zIndex !== undefined && { zIndex }),
  };

  return (
    <Pressable onPress={onDismiss} style={overlayStyle}>
      {children}
    </Pressable>
  );
}
