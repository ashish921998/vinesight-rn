import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { borderRadius, spacing } from '@/styles/theme';

interface AndroidModalSheetProps {
  visible: boolean;
  onClose: () => void;
  backgroundColor: string;
  children: React.ReactNode;
  maxHeight?: `${number}%`;
}

/** RN-native Android sheet used where Compose cannot host nested RN controls reliably. */
export function AndroidModalSheet({
  visible,
  onClose,
  backgroundColor,
  children,
  maxHeight = '70%',
}: AndroidModalSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0, 0, 0, 0.32)',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close picker"
          onPress={onClose}
          style={{ flex: 1 }}
        />
        <View
          style={{
            height: maxHeight,
            overflow: 'hidden',
            borderTopLeftRadius: borderRadius['3xl'],
            borderTopRightRadius: borderRadius['3xl'],
            backgroundColor,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: spacing[8],
              height: spacing[1],
              marginTop: spacing[2],
              borderRadius: borderRadius.full,
              backgroundColor: 'rgba(0, 0, 0, 0.28)',
            }}
          />
          {children}
        </View>
      </View>
    </Modal>
  );
}
