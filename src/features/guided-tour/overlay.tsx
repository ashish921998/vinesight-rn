import React from 'react';
import { View, StyleSheet } from 'react-native';

export function GuidedTourOverlay({ children }: { children: React.ReactNode }) {
  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}
    >
      {children}
    </View>
  );
}
