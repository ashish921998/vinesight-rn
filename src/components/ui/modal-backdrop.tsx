import React, { type ReactNode } from 'react';
import { BottomSheet, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { useM3 } from '@/styles/use-theme';

export interface ModalBackdropProps {
  visible: boolean;
  onDismiss: () => void;
  children: ReactNode;
  alignment?: 'center' | 'flex-end';
  opacity?: number;
  zIndex?: number;
}

/**
 * Native bottom-sheet host with platform-managed scrim and dismissal.
 * Use for bottom sheets and pickers that should be anchored at the bottom.
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
  void opacity;
  void zIndex;

  return (
    <BottomSheet
      index={visible ? 0 : -1}
      snapPoints={alignment === 'center' ? ['50%'] : ['65%', '95%']}
      enablePanDownToClose
      onClose={onDismiss}
      backgroundStyle={{ backgroundColor: m3.surface.s100 }}
    >
      <BottomSheetView style={{ flex: 1 }}>{children}</BottomSheetView>
    </BottomSheet>
  );
}
