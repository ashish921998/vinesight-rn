import React from 'react';
import { BottomSheet } from '@expo/ui/community/bottom-sheet';

interface QuickLogSheetContainerProps {
  open: boolean;
  fullHeight: boolean;
  backgroundColor: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Native iOS sheet host. Android uses the platform-specific RN Modal host. */
export function QuickLogSheetContainer({
  open,
  fullHeight,
  backgroundColor,
  onClose,
  children,
}: QuickLogSheetContainerProps) {
  return (
    <BottomSheet
      index={open ? 0 : -1}
      enableDynamicSizing={!fullHeight}
      snapPoints={fullHeight ? ['92%'] : undefined}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor }}
    >
      {children}
    </BottomSheet>
  );
}
