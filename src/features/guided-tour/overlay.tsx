import React from 'react';
import { View, StyleSheet } from 'react-native';

interface GuidedTourOverlayProps {
  children: React.ReactNode;
  visible?: boolean;
}

export function GuidedTourOverlay({ children, visible = true }: GuidedTourOverlayProps) {
  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}
    >
      {children}
    </View>
  );
}
