import React from 'react';
import { Modal, Pressable, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useM3 } from '@/styles/use-theme';
import { borderRadius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { slideUp } from '@/lib/animations';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: string | number;
  contentStyle?: ViewStyle;
}

export function BottomSheet({
  visible,
  onClose,
  children,
  maxHeight = '80%',
  contentStyle,
}: BottomSheetProps) {
  const m3 = useM3();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colorWithOpacity(m3.colorScheme.scrim, 0.45) }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss bottom sheet"
          style={{ flex: 1 }}
        />
        <Animated.View
          entering={slideUp}
          style={[
            {
              borderTopLeftRadius: borderRadius['3xl'],
              borderTopRightRadius: borderRadius['3xl'],
              paddingHorizontal: spacing[4],
              paddingTop: spacing[4],
              paddingBottom: spacing[6],
              backgroundColor: m3.surface.surfaceContainerLow,
              maxHeight,
            } as never,
            contentStyle as never,
          ]}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 44,
              height: 5,
              borderRadius: borderRadius.full,
              marginBottom: spacing[4],
              backgroundColor: m3.colorScheme.outlineVariant,
            }}
          />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
