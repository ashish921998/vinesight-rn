import React, { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import {
  BottomSheet,
  BottomSheetView,
  type BottomSheetProps,
} from '@expo/ui/community/bottom-sheet';
import { useM3 } from '@/styles/use-theme';

export interface ModalBackdropProps {
  visible: boolean;
  onDismiss: () => void;
  children: ReactNode;
  alignment?: 'center' | 'flex-end';
  opacity?: number;
  zIndex?: number;
  snapPoints?: BottomSheetProps['snapPoints'];
  fitToContents?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
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
  snapPoints,
  fitToContents = false,
  contentStyle,
}: ModalBackdropProps) {
  const m3 = useM3();
  void opacity;
  void zIndex;
  const defaultSnapPoints = alignment === 'center' ? ['50%'] : ['65%', '95%'];

  return (
    <BottomSheet
      index={visible ? 0 : -1}
      snapPoints={fitToContents ? undefined : (snapPoints ?? defaultSnapPoints)}
      enableDynamicSizing={fitToContents}
      enablePanDownToClose
      onClose={onDismiss}
      backgroundStyle={{ backgroundColor: m3.surface.s100 }}
    >
      <BottomSheetView style={[fitToContents ? { width: '100%' } : { flex: 1 }, contentStyle]}>
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
}
